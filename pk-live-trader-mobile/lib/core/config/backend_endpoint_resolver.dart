import 'app_config.dart';
import 'backend_endpoint_probe.dart';

class ResolveResult {
  const ResolveResult({
    required this.apiBase,
    required this.useRemote,
    this.viaTailscaleFallback = false,
  });

  final String apiBase;
  final bool useRemote;
  /// Local mode but LAN failed (often Tailscale VPN on phone) — using Mac Tailscale IP.
  final bool viaTailscaleFallback;
}

/// Find a backend URL the device can reach.
Future<ResolveResult?> resolveReachableEndpoint({required bool preferRemote}) async {
  if (preferRemote) {
    if (await probeBackend(AppConfig.remoteApiBase) == null) {
      return ResolveResult(
        apiBase: AppConfig.remoteApiBase,
        useRemote: true,
      );
    }
    return null;
  }

  for (final base in AppConfig.localProbeBases) {
    if (await probeBackend(base) == null) {
      return ResolveResult(
        apiBase: base,
        useRemote: false,
      );
    }
  }

  // LAN failed (common on iOS with Tailscale ON — errno 65 no route to host)
  if (await probeBackend(AppConfig.remoteApiBase) == null) {
    return const ResolveResult(
      apiBase: AppConfig.remoteApiBase,
      useRemote: false,
      viaTailscaleFallback: true,
    );
  }

  return null;
}
