package com.salaai.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (this.bridge == null) {
            return;
        }
        this.bridge.setWebViewClient(new SalaWebViewClient(this.bridge));
        openInAppUrl(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openInAppUrl(intent);
    }

    private void openInAppUrl(Intent intent) {
        if (intent == null || this.bridge == null || this.bridge.getWebView() == null || intent.getData() == null) {
            return;
        }
        String target = SalaNavigation.urlToLoad(intent.getData().toString());
        if (target != null) {
            this.bridge.getWebView().loadUrl(target);
        }
    }
}
