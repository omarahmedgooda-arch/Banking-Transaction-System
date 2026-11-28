package com.ershak;

import com.ershak.api.Api;
import com.ershak.db.Database;
import com.ershak.service.Bank;
import com.ershak.service.Seeder;
import com.ershak.web.WebServer;

/**
 * Starts Ershak: database → core services → REST API → web app.
 * <p>
 * Optional environment variables:
 * <ul>
 *   <li>PORT – HTTP port (default 7070)</li>
 *   <li>ERSHAK_DB – JDBC URL (default jdbc:sqlite:ershak.db)</li>
 *   <li>ERSHAK_DEMO_DATA – create demo customers on first start (default true)</li>
 *   <li>GEMINI_API_KEY / GROQ_API_KEY – turn on the AI coach and receipt reading (optional)</li>
 *   <li>ERSHAK_ALLOWED_ORIGIN – web app origin when the frontend is hosted elsewhere (for deploy)</li>
 * </ul>
 */
public final class App {

    private App() {
    }

    public static void main(String[] args) throws Exception {
        boolean fixedPort = System.getenv("PORT") != null && !System.getenv("PORT").isBlank();
        int port = Integer.parseInt(env("PORT", "7070"));
        boolean openBrowser = java.util.Arrays.asList(args).contains("--open");
        String dbUrl = env("ERSHAK_DB", "jdbc:sqlite:ershak.db");
        boolean demo = Boolean.parseBoolean(env("ERSHAK_DEMO_DATA", "true"));

        Bank bank = new Bank(Database.init(dbUrl));
        Seeder.seed(bank, demo);

        WebServer server = startOnFreePort(bank, port, fixedPort, System.getenv("ERSHAK_ALLOWED_ORIGIN"));
        Runtime.getRuntime().addShutdownHook(new Thread(server::stop));

        System.out.println();
        System.out.println("  Ershak is running: http://localhost:" + server.port());
        System.out.println("  Officer login: " + Seeder.ADMIN_USERNAME + " / " + Seeder.ADMIN_PASSWORD
                + "   Demo customer: omar.ahmed / " + Seeder.DEMO_PASSWORD);
        System.out.println();

        if (openBrowser) {
            openBrowser("http://localhost:" + server.port());
        }
    }

    /**
     * Starts on the requested port. If that port is taken by another program and the port
     * was not set explicitly, tries the next 20 ports so the app still starts.
     */
    private static WebServer startOnFreePort(Bank bank, int port, boolean fixed, String origin) throws Exception {
        int attempts = fixed ? 1 : 20;
        for (int i = 0; i < attempts; i++) {
            try {
                return start(bank, port + i, origin);
            } catch (java.net.BindException e) {
                if (i == attempts - 1) {
                    throw e;
                }
                System.out.println("  Port " + (port + i) + " is busy, trying " + (port + i + 1) + "...");
            }
        }
        throw new IllegalStateException("unreachable");
    }

    private static void openBrowser(String url) {
        try {
            String os = System.getProperty("os.name").toLowerCase();
            if (os.contains("win")) {
                new ProcessBuilder("rundll32", "url.dll,FileProtocolHandler", url).start();
            } else if (os.contains("mac")) {
                new ProcessBuilder("open", url).start();
            } else {
                new ProcessBuilder("xdg-open", url).start();
            }
        } catch (Exception e) {
            System.out.println("  Open " + url + " in your browser.");
        }
    }

    public static WebServer start(Bank bank, int port, String allowedOrigin) throws Exception {
        WebServer server = new WebServer(allowedOrigin);
        new Api(bank).register(server);
        server.start(port);
        return server;
    }

    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return v == null || v.isBlank() ? fallback : v;
    }
}
