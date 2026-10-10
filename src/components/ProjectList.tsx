import React, { useEffect, useState } from 'react';
import { FolderKanban } from 'lucide-react';
import {
  deleteSavedProject,
  listSavedProjects,
  openSavedProject,
  type SavedProject
} from '../services/savedProjects';

interface ProjectListProps {
  onOpen: () => void;
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('th-TH', { hour12: false, timeZone: 'Asia/Bangkok' });
}

export const ProjectList: React.FC<ProjectListProps> = ({ onOpen }) => {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    setProjects(listSavedProjects());
  }, []);

  const refresh = () => setProjects(listSavedProjects());

  const handleOpen = (id: string) => {
    const opened = openSavedProject(id);
    if (opened) onOpen();
  };

  const handleDelete = (id: string) => {
    if (deleteSavedProject(id)) {
      setConfirmId(null);
      refresh();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-6 pb-32">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
          <FolderKanban className="w-5 h-5" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">โปรเจกต์</h1>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-[#0e1424] p-8 text-center text-sm text-slate-300">
          ยังไม่มีโปรเจกต์ที่บันทึก กดบันทึกโปรเจกต์ในหน้างาน
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => {
            const characterNames = project.characters.map((character) => character.name).filter(Boolean).join(', ');
            const locationNames = project.locations.map((location) => location.name).filter(Boolean).join(', ');
            return (
              <li
                key={project.id}
                className="rounded-2xl border border-slate-800 bg-[#0e1424] hover:border-cyan-500/40 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => handleOpen(project.id)}
                  className="w-full text-left p-4"
                >
                  <div className="text-base font-bold text-white">{project.name}</div>
                  <div className="mt-1 text-sm text-slate-300">
                    ตัวละคร: {characterNames || '—'}
                  </div>
                  <div className="text-sm text-slate-300">
                    สถานที่: {locationNames || '—'}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {project.clips.length} คลิป · {formatSavedAt(project.savedAt)}
                  </div>
                </button>
                <div className="px-4 pb-4">
                  {confirmId === project.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-rose-200">ลบโปรเจกต์นี้หรือไม่</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(project.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
                      >
                        ลบ
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(project.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-rose-950/40 text-rose-300 border border-slate-700"
                    >
                      ลบ
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
