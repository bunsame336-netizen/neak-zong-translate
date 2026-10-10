package com.neakzong.translate;

import android.content.Context;
import android.net.Uri;
import android.util.Log;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

public class LocalVideoServer {
    private static final String TAG = "LocalVideoServer";
    private static final int DEFAULT_PORT = 8080;
    private static ServerSocket serverSocket;
    private static ExecutorService threadPool;
    private static volatile boolean isRunning = false;
    private static volatile int activePort = DEFAULT_PORT;
    private static volatile File currentVideoFile = null;
    private static Context appContext;

    public static synchronized void start(Context context) {
        appContext = context.getApplicationContext();
        if (isRunning) return;

        File cacheDir = appContext.getCacheDir();
        File defaultFile = new File(cacheDir, "local_video.mp4");
        if (defaultFile.exists() && defaultFile.length() > 0) {
            currentVideoFile = defaultFile;
        }

        int[] portsToTry = {DEFAULT_PORT, 8081, 8088, 8888, 9090, 0};
        for (int p : portsToTry) {
            try {
                if (p == 0) {
                    serverSocket = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
                } else {
                    serverSocket = new ServerSocket(p, 50, InetAddress.getByName("127.0.0.1"));
                }
                activePort = serverSocket.getLocalPort();
                isRunning = true;
                break;
            } catch (IOException ignored) {}
        }

        if (!isRunning || serverSocket == null) {
            Log.e(TAG, "Failed to bind LocalVideoServer socket");
            return;
        }

        Log.i(TAG, "LocalVideoServer started on 127.0.0.1:" + activePort);
        threadPool = Executors.newCachedThreadPool();

        new Thread(() -> {
            while (isRunning && serverSocket != null && !serverSocket.isClosed()) {
                try {
                    Socket client = serverSocket.accept();
                    if (!isRunning) {
                        try { client.close(); } catch (Exception ignored) {}
                        break;
                    }
                    threadPool.execute(() -> handleClient(client));
                } catch (Exception e) {
                    if (!isRunning) break;
                    Log.e(TAG, "Accept error", e);
                }
            }
        }, "LocalVideoServer-Acceptor").start();
    }

    public static synchronized void stop() {
        isRunning = false;
        if (serverSocket != null) {
            try {
                serverSocket.close();
            } catch (Exception ignored) {}
            serverSocket = null;
        }
        if (threadPool != null) {
            threadPool.shutdownNow();
            threadPool = null;
        }
        Log.i(TAG, "LocalVideoServer stopped");
    }

    public static int getPort() {
        return activePort;
    }

    public static String getVideoUrl() {
        return "http://127.0.0.1:" + activePort + "/local_video.mp4";
    }

    public static synchronized void saveVideoUri(Context context, Uri uri) throws IOException {
        File cacheDir = context.getCacheDir();
        File targetFile = new File(cacheDir, "local_video.mp4");
        File tempFile = new File(cacheDir, "local_video_tmp.mp4");

        if (tempFile.exists()) tempFile.delete();

        try (InputStream in = context.getContentResolver().openInputStream(uri);
             FileOutputStream out = new FileOutputStream(tempFile)) {
            if (in == null) throw new IOException("Cannot open input stream for Uri: " + uri);
            byte[] buf = new byte[65536];
            int read;
            while ((read = in.read(buf)) != -1) {
                out.write(buf, 0, read);
            }
            out.flush();
        }

        if (tempFile.exists() && tempFile.length() > 0) {
            if (targetFile.exists()) targetFile.delete();
            if (tempFile.renameTo(targetFile)) {
                currentVideoFile = targetFile;
            } else {
                currentVideoFile = tempFile;
            }
            Log.i(TAG, "Saved video file successfully: " + currentVideoFile.getAbsolutePath() + " (" + currentVideoFile.length() + " bytes)");
        }
    }

    private static void handleClient(Socket socket) {
        try {
            socket.setSoTimeout(30000);
            InputStream rawIn = socket.getInputStream();
            OutputStream rawOut = socket.getOutputStream();

            // Read raw headers carefully without closing underlying stream
            ByteArrayOutputStream headerBuffer = new ByteArrayOutputStream();
            int b;
            int consecutiveNewlines = 0;
            while ((b = rawIn.read()) != -1) {
                headerBuffer.write(b);
                if (b == '\n') {
                    consecutiveNewlines++;
                    if (headerBuffer.size() >= 4) {
                        byte[] bytes = headerBuffer.toByteArray();
                        int len = bytes.length;
                        if ((bytes[len - 4] == '\r' && bytes[len - 3] == '\n' && bytes[len - 2] == '\r' && bytes[len - 1] == '\n') ||
                            (bytes[len - 2] == '\n' && bytes[len - 1] == '\n')) {
                            break;
                        }
                    }
                } else if (b != '\r') {
                    consecutiveNewlines = 0;
                }
            }

            String headerText = new String(headerBuffer.toByteArray(), "UTF-8");
            String[] lines = headerText.split("\r?\n");
            if (lines.length == 0 || lines[0].isEmpty()) {
                socket.close();
                return;
            }

            String requestLine = lines[0];
            String[] parts = requestLine.split(" ");
            if (parts.length < 2) {
                socket.close();
                return;
            }
            String method = parts[0].toUpperCase(Locale.ROOT);
            String path = parts[1];

            // Parse headers
            Map<String, String> headers = new HashMap<>();
            for (int i = 1; i < lines.length; i++) {
                String line = lines[i];
                int idx = line.indexOf(':');
                if (idx > 0) {
                    headers.put(line.substring(0, idx).trim().toLowerCase(Locale.ROOT), line.substring(idx + 1).trim());
                }
            }

            // Handle CORS preflight
            if ("OPTIONS".equals(method)) {
                String resp = "HTTP/1.1 204 No Content\r\n" +
                        "Access-Control-Allow-Origin: *\r\n" +
                        "Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD\r\n" +
                        "Access-Control-Allow-Headers: *\r\n" +
                        "Access-Control-Max-Age: 86400\r\n" +
                        "Content-Length: 0\r\n\r\n";
                rawOut.write(resp.getBytes("UTF-8"));
                rawOut.flush();
                socket.close();
                return;
            }

            // Handle POST /upload_preview or /upload
            if ("POST".equals(method) && (path.startsWith("/upload") || path.startsWith("/api/local_upload"))) {
                long contentLength = 0;
                String clStr = headers.get("content-length");
                if (clStr != null) {
                    try { contentLength = Long.parseLong(clStr); } catch (Exception ignored) {}
                }

                if (appContext != null && contentLength > 0) {
                    File cacheDir = appContext.getCacheDir();
                    File tempFile = new File(cacheDir, "local_video_tmp.mp4");
                    File targetFile = new File(cacheDir, "local_video.mp4");
                    try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                        byte[] buf = new byte[65536];
                        long remaining = contentLength;
                        while (remaining > 0) {
                            int toRead = (int) Math.min(buf.length, remaining);
                            int read = rawIn.read(buf, 0, toRead);
                            if (read == -1) break;
                            fos.write(buf, 0, read);
                            remaining -= read;
                        }
                        fos.flush();
                    }
                    if (tempFile.exists() && tempFile.length() > 0) {
                        if (targetFile.exists()) targetFile.delete();
                        tempFile.renameTo(targetFile);
                        currentVideoFile = targetFile;
                    }
                }

                String json = "{\"status\":\"ok\",\"url\":\"" + getVideoUrl() + "\"}";
                byte[] jsonBytes = json.getBytes("UTF-8");
                String resp = "HTTP/1.1 200 OK\r\n" +
                        "Content-Type: application/json\r\n" +
                        "Content-Length: " + jsonBytes.length + "\r\n" +
                        "Access-Control-Allow-Origin: *\r\n\r\n";
                rawOut.write(resp.getBytes("UTF-8"));
                rawOut.write(jsonBytes);
                rawOut.flush();
                socket.close();
                return;
            }

            // Handle status / ping
            if (path.startsWith("/status") || path.startsWith("/ping")) {
                boolean hasVid = currentVideoFile != null && currentVideoFile.exists() && currentVideoFile.length() > 0;
                long sz = hasVid ? currentVideoFile.length() : 0;
                String json = "{\"status\":\"ok\",\"hasVideo\":" + hasVid + ",\"size\":" + sz + ",\"url\":\"" + getVideoUrl() + "\"}";
                byte[] jsonBytes = json.getBytes("UTF-8");
                String resp = "HTTP/1.1 200 OK\r\n" +
                        "Content-Type: application/json\r\n" +
                        "Content-Length: " + jsonBytes.length + "\r\n" +
                        "Access-Control-Allow-Origin: *\r\n\r\n";
                rawOut.write(resp.getBytes("UTF-8"));
                rawOut.write(jsonBytes);
                rawOut.flush();
                socket.close();
                return;
            }

            // Video streaming endpoint (handles /local_video.mp4 and /exports/NeakZong_Dubbed.mp4)
            File videoFile = null;

            if (path.contains("exports") || path.contains("Dubbed")) {
                if (appContext != null) {
                    File dubbedCache = new File(appContext.getCacheDir(), "NeakZong_Dubbed.mp4");
                    // Fetch latest dubbed video with Khmer audio from cloud server only if needed
                    boolean needsFetch = !dubbedCache.exists() || (System.currentTimeMillis() - dubbedCache.lastModified() > 20000);
                    if (needsFetch) {
                        String cleanPath = path.contains("?") ? path.substring(0, path.indexOf("?")) : path;
                        if (!cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;
                        String cloudUrl = "https://neak-zong-translate.onrender.com" + cleanPath;
                        try {
                            URL u = new URL(cloudUrl);
                            HttpURLConnection conn = (HttpURLConnection) u.openConnection();
                            conn.setConnectTimeout(8000);
                            conn.setReadTimeout(20000);
                            if (conn.getResponseCode() == 200) {
                                File tmpFile = new File(appContext.getCacheDir(), "dubbed_download.tmp");
                                try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(tmpFile)) {
                                    byte[] bbuf = new byte[65536];
                                    int bread;
                                    while ((bread = in.read(bbuf)) != -1) {
                                        fos.write(bbuf, 0, bread);
                                    }
                                    fos.flush();
                                }
                                if (tmpFile.exists() && tmpFile.length() > 1000) {
                                    if (dubbedCache.exists()) dubbedCache.delete();
                                    tmpFile.renameTo(dubbedCache);
                                }
                            }
                        } catch (Exception e) {
                            Log.w(TAG, "Cloud dubbed fetch note: " + e.getMessage());
                        }
                    }

                    if (dubbedCache.exists() && dubbedCache.length() > 1000) {
                        videoFile = dubbedCache;
                    }
                }
            }

            if (videoFile == null) {
                videoFile = currentVideoFile;
            }

            if (videoFile == null || !videoFile.exists() || videoFile.length() == 0) {
                if (appContext != null) {
                    File checkDubbed = new File(appContext.getCacheDir(), "NeakZong_Dubbed.mp4");
                    if (checkDubbed.exists() && checkDubbed.length() > 0) {
                        videoFile = checkDubbed;
                    } else {
                        File check = new File(appContext.getCacheDir(), "local_video.mp4");
                        if (check.exists() && check.length() > 0) {
                            currentVideoFile = check;
                            videoFile = check;
                        }
                    }
                }
            }

            if (videoFile == null || !videoFile.exists() || videoFile.length() == 0) {
                String notFound = "HTTP/1.1 404 Not Found\r\n" +
                        "Content-Length: 0\r\n" +
                        "Access-Control-Allow-Origin: *\r\n\r\n";
                rawOut.write(notFound.getBytes("UTF-8"));
                rawOut.flush();
                socket.close();
                return;
            }

            long fileLength = videoFile.length();
            String rangeHeader = headers.get("range");

            if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                String rangeVal = rangeHeader.substring(6).trim();
                long start = 0;
                long end = fileLength - 1;
                int dashIdx = rangeVal.indexOf('-');
                if (dashIdx != -1) {
                    String startStr = rangeVal.substring(0, dashIdx).trim();
                    String endStr = rangeVal.substring(dashIdx + 1).trim();
                    if (!startStr.isEmpty()) {
                        try { start = Long.parseLong(startStr); } catch (Exception ignored) {}
                    }
                    if (!endStr.isEmpty()) {
                        try { end = Long.parseLong(endStr); } catch (Exception ignored) {}
                    }
                }
                if (end >= fileLength) end = fileLength - 1;
                if (start > end) start = end;

                long contentLength = end - start + 1;

                StringBuilder sb = new StringBuilder();
                sb.append("HTTP/1.1 206 Partial Content\r\n");
                sb.append("Content-Type: video/mp4\r\n");
                sb.append("Accept-Ranges: bytes\r\n");
                sb.append("Content-Range: bytes ").append(start).append("-").append(end).append("/").append(fileLength).append("\r\n");
                sb.append("Content-Length: ").append(contentLength).append("\r\n");
                sb.append("Access-Control-Allow-Origin: *\r\n");
                sb.append("Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n");
                sb.append("Access-Control-Allow-Headers: *\r\n");
                sb.append("Connection: keep-alive\r\n\r\n");

                rawOut.write(sb.toString().getBytes("UTF-8"));

                if (!"HEAD".equals(method)) {
                    try (RandomAccessFile raf = new RandomAccessFile(videoFile, "r")) {
                        raf.seek(start);
                        byte[] buffer = new byte[65536];
                        long remaining = contentLength;
                        while (remaining > 0) {
                            int toRead = (int) Math.min(buffer.length, remaining);
                            int read = raf.read(buffer, 0, toRead);
                            if (read == -1) break;
                            rawOut.write(buffer, 0, read);
                            remaining -= read;
                        }
                    }
                }
                rawOut.flush();
            } else {
                StringBuilder sb = new StringBuilder();
                sb.append("HTTP/1.1 200 OK\r\n");
                sb.append("Content-Type: video/mp4\r\n");
                sb.append("Accept-Ranges: bytes\r\n");
                sb.append("Content-Length: ").append(fileLength).append("\r\n");
                sb.append("Access-Control-Allow-Origin: *\r\n");
                sb.append("Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n");
                sb.append("Access-Control-Allow-Headers: *\r\n");
                sb.append("Connection: keep-alive\r\n\r\n");

                rawOut.write(sb.toString().getBytes("UTF-8"));

                if (!"HEAD".equals(method)) {
                    try (RandomAccessFile raf = new RandomAccessFile(videoFile, "r")) {
                        byte[] buffer = new byte[65536];
                        long remaining = fileLength;
                        while (remaining > 0) {
                            int toRead = (int) Math.min(buffer.length, remaining);
                            int read = raf.read(buffer, 0, toRead);
                            if (read == -1) break;
                            rawOut.write(buffer, 0, read);
                            remaining -= read;
                        }
                    }
                }
                rawOut.flush();
            }
        } catch (SocketException | SocketTimeoutException ignored) {
            // Client closed stream or paused/seeked, normal in media streaming
        } catch (Exception e) {
            Log.e(TAG, "Stream handler error: " + e.getMessage());
        } finally {
            try { socket.close(); } catch (Exception ignored) {}
        }
    }
}
