package com.salaai.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** Hands the bundled sala-ai.apk to the Android installer. No webpage. */
public final class ApkShare {
    private ApkShare() {}

    public static void offerBundledApk(Context context) {
        try {
            File out = new File(context.getCacheDir(), "sala-ai.apk");
            try (InputStream in = context.getAssets().open("public/sala-ai.apk");
                 OutputStream os = new FileOutputStream(out)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) >= 0) {
                    if (n > 0) {
                        os.write(buf, 0, n);
                    }
                }
            }
            Uri uri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                out
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception ex) {
            Toast.makeText(context, "เปิดไฟล์แอปไม่สำเร็จ", Toast.LENGTH_LONG).show();
        }
    }
}
