package com.salaai.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Keeps Sala, API, and the AI Studio auth bridge inside the WebView.
 * Everything else (including accounts.google.com) opens externally.
 */
public class SalaWebViewClient extends BridgeWebViewClient {

    private final Bridge bridge;

    public SalaWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request != null ? request.getUrl() : null;
        String url = uri != null ? uri.toString() : null;
        if (SalaNavigation.decide(url) == SalaNavigation.Decision.IN_APP) {
            return false;
        }
        if (uri != null) {
            try {
                Intent openIntent = new Intent(Intent.ACTION_VIEW, uri);
                this.bridge.getContext().startActivity(openIntent);
            } catch (ActivityNotFoundException ignored) {
                // No installed app can handle this URL.
            }
        }
        return true;
    }
}
