import 'broker_profile.dart';

class BrokerConnectionStatus {
  const BrokerConnectionStatus({
    required this.status,
    required this.phase,
    required this.mode,
    required this.profile,
    required this.profileId,
    required this.host,
    required this.port,
    required this.clientId,
    required this.connected,
    required this.ready,
    required this.streaming,
    this.latencyMs,
    this.subscriptionCount = 0,
    this.message,
    this.updatedAt = 0,
  });

  final String status;
  final String phase;
  final String mode;
  final String profile;
  final String profileId;
  final String host;
  final int port;
  final int clientId;
  final bool connected;
  final bool ready;
  final bool streaming;
  final int? latencyMs;
  final int subscriptionCount;
  final String? message;
  final int updatedAt;

  BrokerMode get brokerMode => brokerModeFromJson(mode);

  factory BrokerConnectionStatus.fromJson(Map<String, dynamic> j) =>
      BrokerConnectionStatus(
        status: j['status'] as String? ?? 'DISCONNECTED',
        phase: j['phase'] as String? ?? 'DISCONNECTED',
        mode: j['mode'] as String? ?? '—',
        profile: j['profile'] as String? ?? '—',
        profileId: j['profileId'] as String? ?? '',
        host: j['host'] as String? ?? '',
        port: (j['port'] as num?)?.toInt() ?? 0,
        clientId: (j['clientId'] as num?)?.toInt() ?? 0,
        connected: j['connected'] as bool? ?? false,
        ready: j['ready'] as bool? ?? false,
        streaming: j['streaming'] as bool? ?? false,
        latencyMs: (j['latencyMs'] as num?)?.toInt(),
        subscriptionCount: (j['subscriptionCount'] as num?)?.toInt() ?? 0,
        message: j['message'] as String?,
        updatedAt: (j['updatedAt'] as num?)?.toInt() ?? 0,
      );
}
