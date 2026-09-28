/**
 * Local (offline, no AI) script parser shared by server.ts and the browser.
 * Moved verbatim from server.ts so the offline split works without the API server.
 * Browser-safe: imports only pure src/services modules (no Node built-ins).
 */
import { isReservedSystemKeyword, isMetadataKeyword, parseSalaScript } from './salaDirectorEngine';
import { parseStoryStructure, normalizeSceneLocation } from './storyEpisodeEngine';
import { lightingForTime, analyzeClipContinuity, formatContinuityForPrompt, normalizePoseList, sceneWarningsFor, syncLocationLockInPrompt } from './continuityEngine';
import { resolveCharacterProfiles, formatCharacterAppearanceLock, mergeDeclaredCharacters, continuityLockCharacter } from './characterAppearance';

// Helper for script analysis fallback using SalaDirectorEngine
export function parseScriptLocally(scriptText: string, requestedClipCount?: number, suppliedCharacters: any[] = []) {
  const parsed = parseSalaScript(scriptText, { defaultClipCount: requestedClipCount });
  const rawClips = parsed.clips;
  const declaredChars = parsed.metadata.declaredCharacters;

  const characterNames = parsed.detectedCharacters.filter(name => !isReservedSystemKeyword(name) && !isMetadataKeyword(name));
  const baseNames = characterNames.length > 0 ? characterNames : declaredChars.map(c => c.name);
  // Character Lock: supplied (library) appearance > script character list > personality + warning.
  // No placeholder appearance is ever invented.
  const scriptDeclared = mergeDeclaredCharacters(declaredChars, scriptText);
  const resolvedChars = resolveCharacterProfiles(baseNames, suppliedCharacters || [], scriptDeclared);
  const characters = resolvedChars.profiles.map((p, idx) => {
    const found = declaredChars.find(c => c.name.toLowerCase() === p.name.toLowerCase());
    return {
      name: p.name,
      description: found?.description || p.personality || '',
      role: idx === 0 ? 'บทนำ' : 'บทสมทบ',
      appearance: p.hasAppearance ? formatCharacterAppearanceLock(p).replace(/^[^(]*\(|\)$/g, '') : '',
      face: p.face,
      hairstyle: p.hair,
      outfit: p.outfit,
      personality: p.personality,
      appearanceSource: p.source,
      lockText: formatCharacterAppearanceLock(p)
    };
  });
  const characterWarnings = resolvedChars.warnings;

  const dialogues: any[] = [];
  let diagCount = 1;
  rawClips.forEach(c => {
    c.dialogues.forEach(d => {
      if (d.speaker && !isReservedSystemKeyword(d.speaker) && !isMetadataKeyword(d.speaker)) {
        dialogues.push({
          id: `diag_server_${diagCount++}`,
          speaker: d.speaker,
          line: d.line,
          emotionTone: d.emotionTone || 'ตามบทต้นฉบับ',
          sceneNumber: c.clipNumber
        });
      }
    });
  });

  const lockMeta = parsed.metadata.lockDirectives;
  const detectedLocation = parsed.metadata.location || lockMeta['location'] || '';
  const detectedTime = parsed.metadata.timeOfDay || lockMeta['time'] || '';
  const detectedLighting = parsed.metadata.lighting || lockMeta['lighting'] || '';
  const detectedStyle = parsed.metadata.style || lockMeta['style'] || 'Cinematic Photorealistic 8K';
  const detectedProps = parsed.metadata.props || lockMeta['props'] || '';
  const detectedTitle = parsed.metadata.title || rawClips[0]?.title || 'บทละคร';

  // Per-scene place/time from the story engine (title/mood headings inherit the previous place)
  const storyParsed = parseStoryStructure(scriptText);
  const storyScenes = storyParsed.hasSceneHeaders && storyParsed.scenes.length === rawClips.length ? storyParsed.scenes : [];
  const firstLoc = storyScenes.find(sc => sc.location)?.location || '';
  const firstTime = storyScenes.find(sc => sc.timeOfDay)?.timeOfDay || '';
  const mainLocation = detectedLocation || firstLoc;
  const mainTime = detectedTime || firstTime;
  // One Location Lock lighting description reused by every scene
  const mainLighting = detectedLighting || (mainTime ? lightingForTime(mainTime) : '');

  const introducedSoFar = new Set<string>();

  const scenes = rawClips.map((c, idx) => {
    const ss = storyScenes[idx];
    const sceneLocation = ss?.location || mainLocation;
    const sceneTime = ss?.timeOfDay || mainTime;
    const sceneLighting = sceneLocation === mainLocation && sceneTime === mainTime ? mainLighting : (detectedLighting || lightingForTime(sceneTime));
    const cleanTitle = (c.title || `ฉากที่ ${c.clipNumber}`).replace(/^(ฉากที่\s*\d+)\s*[:：]?\s*[—–\-:]\s*/, '$1: ');
    const sceneBody = c.actions.join(' ');
    const sceneDialogues = dialogues.filter((d) => d.sceneNumber === c.clipNumber);
    const diagSummary = sceneDialogues.map((d) => `${d.speaker}: "${d.line}"`).join(' ');
    const sceneFullText = `${c.title} ${sceneBody} ${diagSummary}`;

    const sceneCharNames = characters
      .filter((char) => {
        const firstName = char.name.split(' ')[0];
        return sceneFullText.includes(char.name) ||
          (firstName.length >= 2 && sceneFullText.includes(firstName)) ||
          sceneDialogues.some(d => d.speaker === char.name || d.line.includes(char.name));
      })
      .map((char) => char.name);

    sceneCharNames.forEach(name => introducedSoFar.add(name));

    // Characters active in this clip: only those introduced up to this scene!
    const charList = sceneCharNames.length > 0
      ? sceneCharNames
      : Array.from(introducedSoFar);

    const promptParts = [detectedStyle];
    if (charList.length > 0) promptParts.push(`Character Lock: ${charList.map(n => characters.find(x => x.name === n)?.lockText || n).join(' | ')}`);
    if (sceneLocation) promptParts.push(`Location Lock: ${sceneLocation}`);
    if (sceneTime) promptParts.push(`Time: ${sceneTime}`);
    if (sceneLighting) promptParts.push(`Lighting Lock: ${sceneLighting}`);
    if (sceneBody) promptParts.push(`Scene Action: ${sceneBody}`);
    if (diagSummary) promptParts.push(`Dialogue: ${diagSummary}`);
    if (c.endState) promptParts.push(`Ending momentum: ${c.endState}`);

    return {
      sceneNumber: c.clipNumber,
      title: cleanTitle,
      location: sceneLocation,
      timeOfDay: sceneTime,
      lighting: sceneLighting,
      camera: c.cameraDirectives[0] || 'Cinematic tracking shot, 35mm prime, Medium Shot',
      characters: charList,
      action: sceneBody || `เหตุการณ์ในฉากที่ ${c.clipNumber}`,
      dialogue: diagSummary,
      prompt: promptParts.join(', ')
    };
  });

  const mainChar = characters[0]?.name || '';

  return {
    title: detectedTitle,
    characters,
    dialogues,
    locations: Array.from(new Set(scenes.map(sc => sc.location).filter(Boolean))).map((name, i) => ({
      name,
      description: i === 0 ? 'สถานที่หลักของการถ่ายทำ' : 'สถานที่ในบท',
      atmosphere: scenes.find(sc => sc.location === name)?.timeOfDay || ''
    })),
    scenes,
    lighting: mainLighting,
    camera: {
      movement: 'Cinematic tracking shot smoothly gliding alongside character',
      lensType: '35mm Anamorphic Prime f/1.8',
      shotType: 'Medium Shot',
    },
    characterWarnings,
    continuityLock: {
      characterName: mainChar,
      characterAppearance: characters[0]?.appearance || '',
      location: mainLocation,
      timeOfDay: mainTime,
      lighting: mainLighting,
      visualStyle: detectedStyle,
      cameraMovement: 'Cinematic tracking shot smoothly gliding alongside character',
      cameraShotType: 'Medium Shot',
      lensType: '35mm Anamorphic Prime f/1.8',
      props: detectedProps,
    },
    source: 'fallback-parser'
  };
}

// Forces the user's lock values into every split scene + the returned continuityLock
export function applySplitLocks(data: any, continuityLock: any, opts: { characters?: any[]; scriptText?: string } = {}): any {
  const lock = continuityLock || {};
  if (!data || typeof data !== 'object') return data;
  const isEmpty = (v: any) => !v || (typeof v === 'string' && (!v.trim() || v.includes('ไม่ระบุ')));
  // Location Lock: scenes whose own location differs from the locked one (warned, lock wins)
  const locationOverrides = new Map<number, string>();
  const lightingOverrides = new Map<number, string>();
  if (Array.isArray(data.scenes)) {
    let prevLoc = '';
    let prevTime = '';
    data.scenes = data.scenes.map((s: any, sIdx: number) => {
      const next = { ...s };
      // "ฉากที่ 3: อารมณ์เริ่มตึงเครียด" / "หน้าบ้านต่อเนื่อง" are not new places
      const norm = normalizeSceneLocation(next.location || '');
      next.location = norm.location;
      if ((norm.isTitle || isEmpty(next.location)) && prevLoc) {
        next.location = prevLoc;
        if (isEmpty(next.timeOfDay)) next.timeOfDay = prevTime;
      }
      if (norm.continued && isEmpty(next.timeOfDay)) next.timeOfDay = prevTime;
      if (!isEmpty(next.location)) prevLoc = next.location;
      if (!isEmpty(next.timeOfDay)) prevTime = next.timeOfDay;
      if (lock.location && !isEmpty(next.location) && !norm.isTitle && next.location !== lock.location && !next.location.includes(lock.location) && !lock.location.includes(next.location)) {
        locationOverrides.set(sIdx, next.location);
      }
      if (lock.location) next.location = lock.location;
      const timeChanged = !!lock.timeOfDay && !isEmpty(next.timeOfDay) && next.timeOfDay !== lock.timeOfDay;
      if (lock.timeOfDay) next.timeOfDay = lock.timeOfDay;
      if (lock.lighting) next.lighting = lock.lighting;
      // Location Lock: a locked time without a locked lighting gets that time's lighting (not the script's)
      else if (timeChanged) { next.lighting = lightingForTime(lock.timeOfDay); lightingOverrides.set(sIdx, next.lighting); }
      else if (isEmpty(next.lighting) && data.lighting) next.lighting = data.lighting;
      const lockedNames = [lock.characterName, ...(lock.characterNames || [])].filter(Boolean);
      if (lockedNames.length > 0 && Array.isArray(next.characters)) {
        // Keep scene characters, but make sure locked names are spelled exactly as locked
        next.characters = next.characters.map((n: string) => lockedNames.find((l: string) => l === n || l.includes(n) || n.includes(l)) || n);
      }
      return next;
    });
  }
  // Character Lock with appearance (library > script character list) + Position Lock per scene
  if (Array.isArray(data.scenes) && data.scenes.length > 0) {
    const scriptDeclared = mergeDeclaredCharacters(Array.isArray(data.characters) ? data.characters : [], opts.scriptText || '');
    const supplied = [
      ...(Array.isArray(opts.characters) ? opts.characters : []),
      ...continuityLockCharacter(lock)
    ];
    const allNames: string[] = Array.from(new Set<string>(data.scenes.flatMap((sc: any) => Array.isArray(sc.characters) ? sc.characters : []).filter(Boolean)));
    const resolved = resolveCharacterProfiles(allNames, supplied, scriptDeclared);
    const lockOf = (n: string) => { const p = resolved.profiles.find(x => x.name === n); return p ? formatCharacterAppearanceLock(p) : n; };
    const initialPoses = normalizePoseList(lock.characterPositionLocks);
    const lockedNames: string[] = Array.from(new Set<string>([...allNames, lock.characterName, ...(lock.characterNames || [])].filter(Boolean)));
    const speakersOf = (sc: any) => (Array.isArray(data.dialogues) ? data.dialogues : []).filter((d: any) => Number(d.sceneNumber) === Number(sc.sceneNumber)).map((d: any) => d.speaker);
    const analysis = analyzeClipContinuity({
      lockedCharacters: lockedNames,
      initialPoses,
      clips: data.scenes.map((sc: any) => ({ text: String(sc.action || ''), speakers: speakersOf(sc), location: sc.location || '' }))
    });
    data.scenes = data.scenes.map((sc: any, i: number) => {
      const names: string[] = Array.isArray(sc.characters) ? sc.characters : [];
      const cont = analysis.clips[i];
      const charLock = names.length > 0 ? `Character Lock: ${names.map(lockOf).join(' | ')}` : '';
      let prompt = String(sc.prompt || '');
      // Replace a name-only Character Lock with the full appearance lock
      if (charLock) prompt = /Character Lock:[^,]*(?:,|$)/.test(prompt) && !prompt.includes(charLock) ? prompt.replace(/Character Lock:.*?(?=, (?:Location Lock|Time|Lighting Lock|Scene Action|Dialogue|Ending momentum):|$)/, charLock) : (prompt.includes(charLock) ? prompt : `${prompt}${prompt ? ', ' : ''}${charLock}`);
      // Location Lock: locked location / time / lighting / set / props in the prompt text too
      prompt = syncLocationLockInPrompt(prompt, lightingOverrides.has(i) ? { ...lock, lighting: lightingOverrides.get(i) } : lock);
      const posBlock = cont ? formatContinuityForPrompt(cont, i === 0 && initialPoses.length === 0) : '';
      if (posBlock && !prompt.includes('Position Lock:')) prompt = `${prompt}${prompt ? '. ' : ''}Continuity Handoff: ${posBlock}.`;
      const sceneWarnings = sceneWarningsFor(analysis.warnings, i + 1, sc.sceneNumber || i + 1);
      if (locationOverrides.has(i)) {
        const sn = sc.sceneNumber || i + 1;
        sceneWarnings.push({ clipNumber: sn, type: 'location_mismatch', character: '', message: `ฉากที่ ${sn}: บทระบุสถานที่ "${locationOverrides.get(i)}" แต่ล็อคสถานที่ไว้ "${lock.location}" — ใช้สถานที่ที่ล็อค / location lock override` });
      }
      return {
        ...sc,
        prompt,
        characterLocks: names.map(n => ({ name: n, lock: lockOf(n) })),
        startPoses: cont?.startPoses || [],
        endPoses: cont?.endPoses || [],
        continuityWarnings: sceneWarnings
      };
    });
    data.characterWarnings = Array.from(new Set([...(data.characterWarnings || []), ...resolved.warnings]));
    data.continuityWarnings = data.scenes.flatMap((sc: any) => sc.continuityWarnings || []);
    data.warnings = [...data.characterWarnings, ...data.continuityWarnings.map((w: any) => w.message)];
    data.characterPositionLocks = data.scenes[data.scenes.length - 1].endPoses;
  }
  data.continuityLock = { ...(data.continuityLock || {}) };
  for (const k of ['characterName', 'characterAppearance', 'location', 'timeOfDay', 'lighting', 'props', 'characterPosition', 'characterPositionLocks']) {
    if (lock[k]) data.continuityLock[k] = lock[k];
  }
  if (!lock.characterName && (isReservedSystemKeyword(data.continuityLock.characterName) || isMetadataKeyword(data.continuityLock.characterName))) {
    data.continuityLock.characterName = data.characters?.[0]?.name || '';
  }
  return data;
}
