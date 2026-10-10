package com.salaai.app;

import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private MediaPlayer welcomePlayer;
    private ImageView splashView;
    private final OnBackPressedCallback backCallback = new OnBackPressedCallback(true) {
        @Override
        public void handleOnBackPressed() {
            WebView webView = bridge != null ? bridge.getWebView() : null;
            if (webView == null) {
                leaveApp();
                return;
            }
            // One press asks the page to move exactly one screen. false means there is no previous page.
            webView.evaluateJavascript(
                "(function(){try{return window.salaGoBackOne?window.salaGoBackOne()===true:false;}catch(e){return false;}})()",
                value -> {
                    if (!"true".equals(value)) {
                        runOnUiThread(MainActivity.this::leaveApp);
                    }
                }
            );
        }
    };

    /** Leave only when the page reports there is no previous screen. Login stays a gate because that path returns false. */
    private void leaveApp() {
        if (isFinishing()) {
            return;
        }
        backCallback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        if (!isFinishing()) {
            backCallback.setEnabled(true);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(SalaGooglePlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, backCallback);
        showPosterSplash();
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

    private void showPosterSplash() {
        splashView = new ImageView(this);
        splashView.setScaleType(ImageView.ScaleType.CENTER_CROP);
        splashView.setImageResource(R.drawable.splash_poster);
        addContentView(
            splashView,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        playWelcomeOnce();
    }

    private void playWelcomeOnce() {
        welcomePlayer = MediaPlayer.create(this, R.raw.sala_welcome);
        if (welcomePlayer == null) {
            if (splashView != null) {
                splashView.postDelayed(this::hideSplash, 1500);
            }
            return;
        }
        welcomePlayer.setLooping(false);
        welcomePlayer.setOnCompletionListener(mp -> {
            releaseWelcomePlayer();
            hideSplash();
        });
        welcomePlayer.setOnErrorListener((mp, what, extra) -> {
            releaseWelcomePlayer();
            hideSplash();
            return true;
        });
        welcomePlayer.start();
    }

    private void hideSplash() {
        if (splashView == null) {
            return;
        }
        ViewGroup parent = (ViewGroup) splashView.getParent();
        if (parent != null) {
            parent.removeView(splashView);
        }
        splashView = null;
    }

    private void releaseWelcomePlayer() {
        MediaPlayer player = welcomePlayer;
        welcomePlayer = null;
        if (player == null) {
            return;
        }
        try {
            player.setOnCompletionListener(null);
            player.setOnErrorListener(null);
            player.release();
        } catch (RuntimeException ignored) {
            // already released
        }
    }

    @Override
    public void onDestroy() {
        releaseWelcomePlayer();
        super.onDestroy();
    }
}
