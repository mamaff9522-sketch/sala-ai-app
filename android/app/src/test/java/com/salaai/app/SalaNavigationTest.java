package com.salaai.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class SalaNavigationTest {

    private static final String SERVER =
        "https://ais-dev-h55mv4dnhb3wfi5gazr272-913251346174.asia-southeast1.run.app";

    @Test
    public void serverRootIsInApp() {
        assertEquals(SalaNavigation.Decision.IN_APP, SalaNavigation.decide(SERVER));
    }

    @Test
    public void serverApiLoginIsInApp() {
        assertEquals(SalaNavigation.Decision.IN_APP, SalaNavigation.decide(SERVER + "/api/auth/login"));
    }

    @Test
    public void aistudioAppletAuthBridgeIsInApp() {
        assertEquals(
            SalaNavigation.Decision.IN_APP,
            SalaNavigation.decide("https://aistudio.google.com/applet-auth-bridge")
        );
    }

    @Test
    public void accountsGoogleIsExternal() {
        assertEquals(
            SalaNavigation.Decision.EXTERNAL,
            SalaNavigation.decide("https://accounts.google.com/o/oauth2/v2/auth")
        );
    }

    @Test
    public void exampleComIsExternal() {
        assertEquals(SalaNavigation.Decision.EXTERNAL, SalaNavigation.decide("https://example.com"));
    }

    @Test
    public void salaaiReturnIsInApp() {
        assertEquals(SalaNavigation.Decision.IN_APP, SalaNavigation.decide("salaai://return"));
    }

    @Test
    public void nullEmptyAndUnparseableAreExternal() {
        assertEquals(SalaNavigation.Decision.EXTERNAL, SalaNavigation.decide(null));
        assertEquals(SalaNavigation.Decision.EXTERNAL, SalaNavigation.decide(""));
        assertEquals(SalaNavigation.Decision.EXTERNAL, SalaNavigation.decide("   "));
        assertEquals(SalaNavigation.Decision.EXTERNAL, SalaNavigation.decide("http://["));
    }

    @Test
    public void apiPathStaysInAppOnAnyHost() {
        assertEquals(SalaNavigation.Decision.IN_APP, SalaNavigation.decide("https://example.com/api"));
        assertEquals(SalaNavigation.Decision.IN_APP, SalaNavigation.decide("https://example.com/api/auth/login"));
        assertEquals(SalaNavigation.Decision.EXTERNAL, SalaNavigation.decide("https://example.com/apiv2"));
    }

    @Test
    public void incomingDeepLinkMapsToServerRootAndHttpsKeepsPathQuery() {
        assertEquals(SERVER, SalaNavigation.urlToLoad("salaai://return"));
        assertEquals(SERVER + "/chat?tab=1", SalaNavigation.urlToLoad(SERVER + "/chat?tab=1"));
        assertNull(SalaNavigation.urlToLoad("https://example.com/"));
        assertNull(SalaNavigation.urlToLoad("https://accounts.google.com/"));
        assertNull(SalaNavigation.urlToLoad(null));
    }
}
