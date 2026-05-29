enum BrokerMode { paper, live }

BrokerMode brokerModeFromJson(String? raw) {
  switch (raw?.toUpperCase()) {
    case 'LIVE':
      return BrokerMode.live;
    default:
      return BrokerMode.paper;
  }
}

String brokerModeLabel(BrokerMode mode) =>
    mode == BrokerMode.live ? 'LIVE' : 'PAPER';

class BrokerProfile {
  const BrokerProfile({
    required this.id,
    required this.name,
    required this.host,
    required this.port,
    required this.clientId,
    required this.mode,
    this.enabled = true,
    this.autoReconnect = true,
    this.adapterType = 'IBKR',
  });

  final String id;
  final String name;
  final String host;
  final int port;
  final int clientId;
  final BrokerMode mode;
  final bool enabled;
  final bool autoReconnect;
  final String adapterType;

  factory BrokerProfile.fromJson(Map<String, dynamic> j) => BrokerProfile(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        host: j['host'] as String? ?? '127.0.0.1',
        port: (j['port'] as num?)?.toInt() ?? 0,
        clientId: (j['clientId'] as num?)?.toInt() ?? 0,
        mode: brokerModeFromJson(j['mode'] as String?),
        enabled: j['enabled'] as bool? ?? true,
        autoReconnect: j['autoReconnect'] as bool? ?? true,
        adapterType: j['adapterType'] as String? ?? 'IBKR',
      );
}
