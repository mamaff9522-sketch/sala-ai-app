package com.salaai.app;

import java.net.URI;
import java.net.URISyntaxException;

/**
 * Decides whether a navigation URL stays in the app WebView.
 * Pure string parsing so JVM unit tests do not need Android Uri.
 */
public final class SalaNavigation {

    public static final String SERVER_HOST =
        "ais-dev-h55mv4dnhb3wfi5gazr272-913251346174.asia-southeast1.run.app";

    public static final String SERVER_ROOT = "https://" + SERVER_HOST;

    public static final String AISTUDIO_HOST = "aistudio.google.com";

    public enum Decision {
        IN_APP,
        EXTERNAL
    }

    private SalaNavigation() {}

    public static Decision decide(String url) {
        if (url == null) {
            return Decision.EXTERNAL;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty()) {
            return Decision.EXTERNAL;
        }

        final URI uri;
        try {
            uri = new URI(trimmed);
        } catch (URISyntaxException ex) {
            return Decision.EXTERNAL;
        }

        String scheme = uri.getScheme();
        if (scheme == null || scheme.isEmpty()) {
            return Decision.EXTERNAL;
        }
        if ("salaai".equalsIgnoreCase(scheme)) {
            return Decision.IN_APP;
        }

        String host = uri.getHost();
        if (host != null && SERVER_HOST.equalsIgnoreCase(host)) {
            return Decision.IN_APP;
        }

        String path = uri.getPath();
        if (path != null && ("/api".equals(path) || path.startsWith("/api/"))) {
            return Decision.IN_APP;
        }

        if (host != null && AISTUDIO_HOST.equalsIgnoreCase(host)) {
            return Decision.IN_APP;
        }

        return Decision.EXTERNAL;
    }

    /**
     * URL the WebView should load for an incoming VIEW intent, or null when the
     * intent is not a Sala deep link or the Cloud Run https URL.
     * salaai://return (any salaai URL) maps to the server root. An https URL on
     * the server host keeps its path and query.
     */
    public static String urlToLoad(String incoming) {
        if (incoming == null) {
            return null;
        }
        String trimmed = incoming.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        final URI uri;
        try {
            uri = new URI(trimmed);
        } catch (URISyntaxException ex) {
            return null;
        }

        String scheme = uri.getScheme();
        if (scheme == null) {
            return null;
        }
        if ("salaai".equalsIgnoreCase(scheme)) {
            return SERVER_ROOT;
        }
        if ("https".equalsIgnoreCase(scheme) && uri.getHost() != null && SERVER_HOST.equalsIgnoreCase(uri.getHost())) {
            return trimmed;
        }
        return null;
    }
}
