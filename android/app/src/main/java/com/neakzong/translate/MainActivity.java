package com.neakzong.translate;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private ValueCallback<Uri[]> mUploadMessageArray;
    private final static int FILECHOOSER_RESULTCODE = 1001;

    public class NativeVideoBridge {
        @JavascriptInterface
        public String getVideoUrl() {
            return LocalVideoServer.getVideoUrl();
        }

        @JavascriptInterface
        public boolean isNative() {
            return true;
        }

        @JavascriptInterface
        public void openFileChooser() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("video/*");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivityForResult(intent, FILECHOOSER_RESULTCODE);
            });
        }
    }

    private void configureWebView() {
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            WebView webView = bridge.getWebView();
            WebSettings settings = webView.getSettings();
            
            // ⚡ Essential Android WebView Media & Storage Settings
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setLoadsImagesAutomatically(true);

            // ⚡ Enable full Hardware Acceleration for smooth HTML5 video decoding
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

            // ⚡ Register AndroidNative JavascriptInterface
            webView.addJavascriptInterface(new NativeVideoBridge(), "AndroidNative");

            // ⚡ WebChromeClient with Full Native File Chooser Support for <input type="file">
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public Bitmap getDefaultVideoPoster() {
                    return Bitmap.createBitmap(10, 10, Bitmap.Config.ARGB_8888);
                }

                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    request.grant(request.getResources());
                }

                @Override
                public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                    if (mUploadMessageArray != null) {
                        mUploadMessageArray.onReceiveValue(null);
                    }
                    mUploadMessageArray = filePathCallback;

                    Intent intent = null;
                    try {
                        if (fileChooserParams != null) {
                            intent = fileChooserParams.createIntent();
                        }
                    } catch (Exception ignored) {}

                    if (intent == null) {
                        intent = new Intent(Intent.ACTION_GET_CONTENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("video/*");
                    }
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                    try {
                        startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                        return true;
                    } catch (Exception e1) {
                        try {
                            Intent chooser = Intent.createChooser(intent, "ជ្រើសរើសវីដេអូ (Select Video)");
                            startActivityForResult(chooser, FILECHOOSER_RESULTCODE);
                            return true;
                        } catch (Exception e2) {
                            if (mUploadMessageArray != null) {
                                mUploadMessageArray.onReceiveValue(null);
                                mUploadMessageArray = null;
                            }
                            return false;
                        }
                    }
                }
            });

            // Handle ALL URLs inside the App: shouldOverrideUrlLoading return false
            webView.setWebViewClient(new BridgeWebViewClient(bridge) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return false;
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    return false;
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILECHOOSER_RESULTCODE) {
            Uri[] results = null;
            try {
                if (resultCode == Activity.RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else {
                        results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                    }
                }
            } catch (Exception ignored) {}

            // Pass results to standard WebChromeClient file chooser
            if (mUploadMessageArray != null) {
                mUploadMessageArray.onReceiveValue(results);
                mUploadMessageArray = null;
            }

            // ⚡ Copy chosen video into local streaming storage and notify WebView immediately
            if (results != null && results.length > 0 && results[0] != null) {
                final Uri chosenUri = results[0];
                new Thread(() -> {
                    try {
                        Log.i(TAG, "Saving chosen video to local streaming server: " + chosenUri);
                        LocalVideoServer.saveVideoUri(MainActivity.this, chosenUri);
                        final String streamUrl = LocalVideoServer.getVideoUrl();
                        Log.i(TAG, "Stream URL ready: " + streamUrl);

                        runOnUiThread(() -> {
                            Bridge bridge = getBridge();
                            if (bridge != null && bridge.getWebView() != null) {
                                String js = "if (window.onNativeVideoReady) { window.onNativeVideoReady('" + streamUrl + "'); }";
                                bridge.getWebView().evaluateJavascript(js, null);
                            }
                        });
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to save local video stream", e);
                    }
                }, "LocalVideo-SaveThread").start();
            }
        }
    }

    private void requestMediaPermissions() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            String[] perms = {
                android.Manifest.permission.READ_MEDIA_VIDEO,
                android.Manifest.permission.READ_MEDIA_IMAGES,
                android.Manifest.permission.READ_MEDIA_AUDIO
            };
            boolean needReq = false;
            for (String p : perms) {
                if (checkSelfPermission(p) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    needReq = true;
                    break;
                }
            }
            if (needReq) {
                requestPermissions(perms, 101);
            }
        } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            if (checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{
                    android.Manifest.permission.READ_EXTERNAL_STORAGE
                }, 101);
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LocalVideoServer.start(this);
        requestMediaPermissions();
        configureWebView();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(this::configureWebView);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        configureWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebView();
    }

    @Override
    public void onDestroy() {
        LocalVideoServer.stop();
        super.onDestroy();
    }
}
