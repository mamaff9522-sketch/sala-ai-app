package com.salaai.app;

import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

/** Device Google account. The account picker is not a password form. */
@CapacitorPlugin(name = "SalaGoogle")
public class SalaGooglePlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("clientId", "");
        if (clientId == null || clientId.isEmpty() || getActivity() == null) {
            call.reject("ยังไม่มีรหัสกูเกิลสำหรับแอป");
            return;
        }
        boolean pickAccount = Boolean.TRUE.equals(call.getBoolean("pickAccount", false));
        GoogleSignInClient client = clientFor(clientId);
        if (pickAccount) {
            client.signOut().addOnCompleteListener(task -> startPicker(call, client));
            return;
        }
        client.silentSignIn()
            .addOnSuccessListener(account -> resolveAccount(call, account))
            .addOnFailureListener(err -> startPicker(call, client));
    }

    private GoogleSignInClient clientFor(String clientId) {
        GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(clientId)
            .requestEmail()
            .build();
        return GoogleSignIn.getClient(getActivity(), options);
    }

    private void startPicker(PluginCall call, GoogleSignInClient client) {
        startActivityForResult(call, client.getSignInIntent(), "signInResult");
    }

    @ActivityCallback
    private void signInResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
        try {
            resolveAccount(call, task.getResult(ApiException.class));
        } catch (ApiException ex) {
            call.reject("กูเกิลบนเครื่องไม่ยอมเข้า (" + ex.getStatusCode() + ")");
        }
    }

    private void resolveAccount(PluginCall call, GoogleSignInAccount account) {
        String idToken = account == null ? "" : account.getIdToken();
        if (idToken == null || idToken.isEmpty()) {
            call.reject("กูเกิลบนเครื่องไม่ส่งรหัสเข้าแอป");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("idToken", idToken);
        call.resolve(ret);
    }
}
