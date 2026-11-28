package com.ershak.web;

import com.ershak.exception.BankException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.function.BiConsumer;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A tiny web framework on top of the JDK's built-in {@link HttpServer}: routing with path
 * parameters, "before" filters, error mapping, security headers and serving the web app.
 * No third-party library is needed to run the server.
 */
public final class WebServer {

    @FunctionalInterface
    public interface Handler {
        void handle(Ctx ctx) throws Exception;
    }

    private record Route(String method, Pattern pattern, List<String> params, Handler handler) {
    }

    private record Filter(String prefix, Handler handler) {
    }

    private static final Logger LOG = Logger.getLogger(WebServer.class.getName());
    private static final Pattern PARAM = Pattern.compile("\\{([a-zA-Z]+)}");
    private static final Map<String, String> CONTENT_TYPES = Map.ofEntries(
            Map.entry("html", "text/html; charset=utf-8"),
            Map.entry("js", "text/javascript; charset=utf-8"),
            Map.entry("css", "text/css; charset=utf-8"),
            Map.entry("json", "application/json"),
            Map.entry("webmanifest", "application/manifest+json"),
            Map.entry("svg", "image/svg+xml"),
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("ico", "image/x-icon"),
            Map.entry("woff2", "font/woff2"),
            Map.entry("woff", "font/woff"),
            Map.entry("webp", "image/webp"),
            Map.entry("txt", "text/plain; charset=utf-8"));

    private final List<Route> routes = new ArrayList<>();
    private final List<Filter> filters = new ArrayList<>();
    private final String allowedOrigin;
    private HttpServer server;

    /** @param allowedOrigin web app origin allowed to call the API from another domain (null = same origin only) */
    public WebServer(String allowedOrigin) {
        this.allowedOrigin = allowedOrigin;
    }

    public void get(String path, Handler h) { route("GET", path, h); }
    public void post(String path, Handler h) { route("POST", path, h); }
    public void put(String path, Handler h) { route("PUT", path, h); }
    public void delete(String path, Handler h) { route("DELETE", path, h); }

    /** Runs before every route whose path starts with the prefix. */
    public void before(String prefix, Handler h) {
        filters.add(new Filter(prefix, h));
    }

    private void route(String method, String path, Handler handler) {
        List<String> names = new ArrayList<>();
        Matcher m = PARAM.matcher(path);
        StringBuilder regex = new StringBuilder("^");
        int last = 0;
        while (m.find()) {
            regex.append(Pattern.quote(path.substring(last, m.start()))).append("([^/]+)");
            names.add(m.group(1));
            last = m.end();
        }
        regex.append(Pattern.quote(path.substring(last))).append("$");
        routes.add(new Route(method, Pattern.compile(regex.toString()), names, handler));
    }

    public void start(int port) throws IOException {
        server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.createContext("/", this::dispatch);
        server.start();
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    public int port() {
        return server.getAddress().getPort();
    }

    private void dispatch(HttpExchange ex) {
        String path = ex.getRequestURI().getPath();
        try {
            securityHeaders(ex);
            if (path.startsWith("/api/")) {
                api(ex, path);
            } else {
                staticFile(ex, path);
            }
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Request failed: " + path, e);
            ex.close();
        }
    }

    private void api(HttpExchange ex, String path) throws IOException {
        cors(ex);
        ex.getResponseHeaders().set("Cache-Control", "no-store");
        if ("OPTIONS".equals(ex.getRequestMethod())) {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }
        Route matched = null;
        Map<String, String> params = new HashMap<>();
        boolean pathExists = false;
        for (Route r : routes) {
            Matcher m = r.pattern().matcher(path);
            if (m.matches()) {
                pathExists = true;
                if (r.method().equals(ex.getRequestMethod())) {
                    matched = r;
                    for (int i = 0; i < r.params().size(); i++) {
                        params.put(r.params().get(i), m.group(i + 1));
                    }
                    break;
                }
            }
        }
        Ctx ctx = new Ctx(ex, params);
        try {
            if (matched == null) {
                ctx.status(pathExists ? 405 : 404).json(error(pathExists ? "METHOD_NOT_ALLOWED" : "NOT_FOUND",
                        pathExists ? "Method not allowed." : "No such endpoint."));
            } else {
                for (Filter f : filters) {
                    if (path.startsWith(f.prefix())) {
                        f.handler().handle(ctx);
                    }
                }
                matched.handler().handle(ctx);
            }
        } catch (BankException e) {
            Map<String, Object> body = error(e.getCode(), e.getMessage());
            errorExtras.accept(e, body);
            ctx.status(e.getHttpStatus()).json(body);
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Unexpected error on " + ex.getRequestMethod() + " " + path, e);
            ctx.status(500).json(error("SERVER_ERROR", "Something went wrong on our side. Try again."));
        }
        ctx.send();
    }

    private BiConsumer<BankException, Map<String, Object>> errorExtras = (e, body) -> { };

    /** Lets the API add extra fields to error responses (for example lockedUntil). */
    public void errorExtras(BiConsumer<BankException, Map<String, Object>> extras) {
        this.errorExtras = extras;
    }

    private static Map<String, Object> error(String code, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", code);
        m.put("message", message);
        return m;
    }

    /** Serves the built web app from the classpath; unknown paths get index.html (single-page app). */
    private void staticFile(HttpExchange ex, String path) throws IOException {
        if (!"GET".equals(ex.getRequestMethod()) && !"HEAD".equals(ex.getRequestMethod())) {
            ex.sendResponseHeaders(405, -1);
            ex.close();
            return;
        }
        String clean = path.equals("/") ? "/index.html" : path;
        if (clean.contains("..") || clean.contains("\\")) {
            ex.sendResponseHeaders(400, -1);
            ex.close();
            return;
        }
        InputStream in = WebServer.class.getResourceAsStream("/public" + clean);
        if (in == null) {
            clean = "/index.html";
            in = WebServer.class.getResourceAsStream("/public/index.html");
        }
        if (in == null) {
            byte[] msg = "Ershak API is running. Build the web app (see README) to get the interface."
                    .getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
            ex.sendResponseHeaders(200, msg.length);
            ex.getResponseBody().write(msg);
            ex.close();
            return;
        }
        byte[] bytes;
        try (InputStream file = in) {
            bytes = file.readAllBytes();
        }
        String ext = clean.substring(clean.lastIndexOf('.') + 1).toLowerCase();
        ex.getResponseHeaders().set("Content-Type", CONTENT_TYPES.getOrDefault(ext, "application/octet-stream"));
        ex.getResponseHeaders().set("Cache-Control",
                clean.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
        ex.sendResponseHeaders(200, bytes.length);
        ex.getResponseBody().write(bytes);
        ex.close();
    }

    private static void securityHeaders(HttpExchange ex) {
        var h = ex.getResponseHeaders();
        h.set("X-Content-Type-Options", "nosniff");
        h.set("X-Frame-Options", "DENY");
        h.set("Referrer-Policy", "no-referrer");
        h.set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; "
                + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                + "font-src 'self' https://fonts.gstatic.com; connect-src 'self' *; frame-ancestors 'none'");
    }

    private void cors(HttpExchange ex) {
        if (allowedOrigin == null || allowedOrigin.isBlank()) {
            return;
        }
        String origin = ex.getRequestHeaders().getFirst("Origin");
        if (origin != null && origin.equals(allowedOrigin)) {
            var h = ex.getResponseHeaders();
            h.set("Access-Control-Allow-Origin", origin);
            h.set("Vary", "Origin");
            h.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Passive");
            h.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        }
    }
}
