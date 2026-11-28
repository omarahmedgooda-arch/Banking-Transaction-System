package com.ershak.web;

import com.ershak.exception.ValidationException;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One HTTP request and its response, wrapped around the JDK's {@link HttpExchange}
 * with the small set of helpers the routes need.
 */
public final class Ctx {

    private static final int MAX_BODY = 64 * 1024;

    private final HttpExchange exchange;
    private final Map<String, String> pathParams;
    private final Map<String, String> query;
    private final Map<String, Object> attributes = new HashMap<>();
    private String body;
    private Map<String, Object> bodyMap;

    private int status = 200;
    private byte[] responseBody = new byte[0];
    private String contentType = "application/json; charset=utf-8";

    Ctx(HttpExchange exchange, Map<String, String> pathParams) {
        this.exchange = exchange;
        this.pathParams = pathParams;
        this.query = parseQuery(exchange.getRequestURI().getRawQuery());
    }

    // ------------------------------------------------------------------ request

    public String method() {
        return exchange.getRequestMethod();
    }

    public String path() {
        return exchange.getRequestURI().getPath();
    }

    public String pathParam(String name) {
        return pathParams.get(name);
    }

    public long pathId() {
        try {
            return Long.parseLong(pathParams.get("id"));
        } catch (NumberFormatException e) {
            throw new ValidationException("Invalid id.");
        }
    }

    public String queryParam(String name) {
        return query.get(name);
    }

    public int queryInt(String name, int fallback) {
        String v = query.get(name);
        if (v == null || v.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            throw new ValidationException(name + " must be a number.");
        }
    }

    public BigDecimal queryDecimal(String name) {
        String v = query.get(name);
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(v.trim());
        } catch (NumberFormatException e) {
            throw new ValidationException(name + " must be a number.");
        }
    }

    public String header(String name) {
        return exchange.getRequestHeaders().getFirst(name);
    }

    /** Client IP (respects X-Forwarded-For when deployed behind a proxy). */
    public String ip() {
        String forwarded = header("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return exchange.getRemoteAddress().getAddress().getHostAddress();
    }

    public String body() {
        if (body == null) {
            try (InputStream in = exchange.getRequestBody()) {
                int max = path().equals("/api/coach/receipt") ? 6 * 1024 * 1024 : MAX_BODY;
                byte[] bytes = in.readNBytes(max + 1);
                if (bytes.length > max) {
                    throw new ValidationException("TOO_LARGE", "Request is too large.");
                }
                body = new String(bytes, StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new ValidationException("Could not read the request.");
            }
        }
        return body;
    }

    /** The JSON body as a map. An empty body is an empty map. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> json() {
        if (bodyMap == null) {
            String b = body();
            if (b.isBlank()) {
                bodyMap = new LinkedHashMap<>();
            } else {
                Object parsed;
                try {
                    parsed = Json.parse(b);
                } catch (Json.JsonException e) {
                    throw new ValidationException("BAD_REQUEST", "The request body is not valid JSON.");
                }
                if (!(parsed instanceof Map)) {
                    throw new ValidationException("BAD_REQUEST", "Expected a JSON object.");
                }
                bodyMap = (Map<String, Object>) parsed;
            }
        }
        return bodyMap;
    }

    public String str(String field) {
        Object v = json().get(field);
        return v == null ? null : String.valueOf(v);
    }

    public BigDecimal decimal(String field) {
        Object v = json().get(field);
        if (v == null || (v instanceof String s && s.isBlank())) {
            return null;
        }
        if (v instanceof BigDecimal d) {
            return d;
        }
        try {
            return new BigDecimal(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            throw new ValidationException("INVALID_AMOUNT", field + " must be a number.");
        }
    }

    public long lng(String field) {
        BigDecimal v = decimal(field);
        if (v == null) {
            throw new ValidationException(field + " is required.");
        }
        try {
            return v.longValueExact();
        } catch (ArithmeticException e) {
            throw new ValidationException(field + " must be a whole number.");
        }
    }

    public boolean bool(String field) {
        Object v = json().get(field);
        return v instanceof Boolean b ? b : "true".equalsIgnoreCase(String.valueOf(v));
    }

    @SuppressWarnings("unchecked")
    public <T> T attribute(String key) {
        return (T) attributes.get(key);
    }

    public void attribute(String key, Object value) {
        attributes.put(key, value);
    }

    // ------------------------------------------------------------------ response

    public Ctx status(int code) {
        this.status = code;
        return this;
    }

    public int status() {
        return status;
    }

    public void json(Object value) {
        contentType = "application/json; charset=utf-8";
        responseBody = Json.write(value).getBytes(StandardCharsets.UTF_8);
    }

    public void result(String text) {
        responseBody = text.getBytes(StandardCharsets.UTF_8);
    }

    public void resultBytes(byte[] bytes) {
        responseBody = bytes;
    }

    public void contentType(String type) {
        this.contentType = type;
    }

    public void header(String name, String value) {
        exchange.getResponseHeaders().set(name, value);
    }

    void send() throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        if (status == 204 || responseBody.length == 0) {
            exchange.sendResponseHeaders(status == 200 && responseBody.length == 0 ? 204 : status, -1);
        } else {
            exchange.sendResponseHeaders(status, responseBody.length);
            exchange.getResponseBody().write(responseBody);
        }
        exchange.close();
    }

    private static Map<String, String> parseQuery(String raw) {
        Map<String, String> out = new HashMap<>();
        if (raw == null || raw.isEmpty()) {
            return out;
        }
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            String k = eq < 0 ? pair : pair.substring(0, eq);
            String v = eq < 0 ? "" : pair.substring(eq + 1);
            out.put(URLDecoder.decode(k, StandardCharsets.UTF_8), URLDecoder.decode(v, StandardCharsets.UTF_8));
        }
        return out;
    }
}
