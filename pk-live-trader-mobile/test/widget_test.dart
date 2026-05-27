import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:pk_live_trader_mobile/main.dart';

void main() {
  testWidgets('App shell loads', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: PkLiveTraderApp()));
    await tester.pump();
    expect(find.text('PK Live Trader'), findsOneWidget);
  });
}
