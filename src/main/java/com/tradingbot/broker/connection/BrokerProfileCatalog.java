package com.tradingbot.broker.connection;

import com.tradingbot.broker.model.BrokerMode;
import com.tradingbot.broker.model.BrokerProfile;
import com.tradingbot.config.IBKRProperties;
import com.tradingbot.config.IbkrClientIdResolver;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class BrokerProfileCatalog {

    /** Prefer Gateway ports when both TWS and Gateway could be installed. */
    private static final List<String> STARTUP_PROBE_ORDER = List.of(
            "paper-gateway", "paper", "live-gateway", "live"
    );

    private final Map<String, BrokerProfile> profiles = new LinkedHashMap<>();

    public BrokerProfileCatalog(IBKRProperties properties) {
        int baseId = IbkrClientIdResolver.baseClientId(properties);
        profiles.put("paper", new BrokerProfile(
                "paper",
                "IBKR Paper",
                properties.getHost(),
                properties.getPaperPort(),
                baseId,
                BrokerMode.PAPER,
                true,
                true,
                "IBKR"
        ));
        profiles.put("live", new BrokerProfile(
                "live",
                "IBKR Live",
                properties.getHost(),
                properties.getLivePort(),
                baseId + 1,
                BrokerMode.LIVE,
                true,
                true,
                "IBKR"
        ));
        profiles.put("paper-gateway", new BrokerProfile(
                "paper-gateway",
                "IB Gateway Paper",
                properties.getHost(),
                properties.getPaperGatewayPort(),
                baseId + 2,
                BrokerMode.PAPER,
                true,
                true,
                "IBKR"
        ));
        profiles.put("live-gateway", new BrokerProfile(
                "live-gateway",
                "IB Gateway Live",
                properties.getHost(),
                properties.getLiveGatewayPort(),
                baseId + 3,
                BrokerMode.LIVE,
                true,
                true,
                "IBKR"
        ));
        // Active port from application config overrides matching profile port
        int configuredPort = properties.getPort();
        if (configuredPort == properties.getLivePort()) {
            profiles.put("live", withPort(profiles.get("live"), configuredPort));
        } else if (configuredPort == properties.getPaperPort()) {
            profiles.put("paper", withPort(profiles.get("paper"), configuredPort));
        }
    }

    private static BrokerProfile withPort(BrokerProfile p, int port) {
        return new BrokerProfile(p.id(), p.name(), p.host(), port, p.clientId(), p.mode(),
                p.enabled(), p.autoReconnect(), p.adapterType());
    }

    public List<BrokerProfile> all() {
        return List.copyOf(profiles.values());
    }

    public Optional<BrokerProfile> find(String id) {
        return Optional.ofNullable(profiles.get(id));
    }

    public BrokerProfile require(String id) {
        return find(id).orElseThrow(() -> new IllegalArgumentException("Unknown broker profile: " + id));
    }

    public BrokerProfile defaultProfile() {
        return profiles.get("paper");
    }

    /**
     * Pick startup profile: saved id if its port is listening, else first open port in probe order,
     * else catalog default (TWS paper).
     */
    public BrokerProfile resolveStartupProfile(Optional<String> persistedProfileId) {
        if (persistedProfileId.isPresent()) {
            BrokerProfile saved = profiles.get(persistedProfileId.get());
            if (saved != null && isPortListening(saved.host(), saved.port())) {
                return saved;
            }
            if (saved != null) {
                log.warn(
                        "Saved broker profile '{}' port {} is not listening — auto-detecting",
                        saved.id(), saved.port()
                );
            }
        }
        return detectListeningProfile()
                .orElseGet(() -> {
                    BrokerProfile fallback = defaultProfile();
                    log.info(
                            "No IBKR API port listening; defaulting to {} ({}:{})",
                            fallback.id(), fallback.host(), fallback.port()
                    );
                    return fallback;
                });
    }

    public Optional<BrokerProfile> detectListeningProfile() {
        for (String id : STARTUP_PROBE_ORDER) {
            BrokerProfile profile = profiles.get(id);
            if (profile != null && isPortListening(profile.host(), profile.port())) {
                log.info(
                        "Auto-detected IBKR API on {}:{} → profile '{}'",
                        profile.host(), profile.port(), profile.id()
                );
                return Optional.of(profile);
            }
        }
        return Optional.empty();
    }

    static boolean isPortListening(String host, int port) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 500);
            return true;
        } catch (IOException e) {
            return false;
        }
    }
}
