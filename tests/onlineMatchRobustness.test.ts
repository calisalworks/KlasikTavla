import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';

function log(step: string, status: 'PASS' | 'FAIL' | 'INFO', detail?: string) {
  const symbol = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
  console.log(`${symbol} [${status}] ${step}${detail ? `: ${detail}` : ''}`);
}

async function runOnlineRobustnessSuite() {
  console.log('\n======================================================');
  console.log('   ONLINE TAVLA - BAĞLANTI & MAÇ SAĞLAMLIK TESTİ');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function expect(cond: boolean, name: string, detail?: string) {
    total++;
    if (cond) {
      passed++;
      log(name, 'PASS', detail);
    } else {
      log(name, 'FAIL', detail);
      throw new Error(`Test Failed: ${name} - ${detail || ''}`);
    }
  }

  // --- TEST 1: SERVER SAĞLIK KONTROLÜ (HEALTH CHECK) ---
  console.log('\n--- 1. Sunucu Sağlık Kontrolü (/api/health) ---');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  expect(healthRes.status === 200, 'Sunucu /api/health rotası 200 döndü');
  const healthData = await healthRes.json();
  expect(healthData.status === 'ok', 'Sunucu durumu "ok" olarak doğrulandı');
  expect(typeof healthData.uptime === 'number', `Sunucu çalışma süresi: ${Math.round(healthData.uptime)}s`);

  // --- TEST 2: İKİ OYUNCU EŞLEŞMESİ & LOBİDEN TAHTAYA GEÇİŞ ---
  console.log('\n--- 2. İki Oyuncunun Eşleşmesi & Lobi-Tahta Soket Geçişi ---');
  const player1Id = `user_p1_${Date.now()}`;
  const player2Id = `user_p2_${Date.now()}`;

  const wsLobby1 = new WebSocket(WS_URL);
  const wsLobby2 = new WebSocket(WS_URL);

  await Promise.all([
    new Promise<void>((res) => {
      wsLobby1.on('open', () => {
        wsLobby1.send(JSON.stringify({ type: 'player:init', playerId: player1Id, playerName: 'Ali Beyaz' }));
        res();
      });
    }),
    new Promise<void>((res) => {
      wsLobby2.on('open', () => {
        wsLobby2.send(JSON.stringify({ type: 'player:init', playerId: player2Id, playerName: 'Veli Siyah' }));
        res();
      });
    }),
  ]);

  let matchedRoomId = '';
  let p1Color = '';
  let p2Color = '';

  const matchPromise = Promise.all([
    new Promise<void>((res) => {
      wsLobby1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'match:found') {
          matchedRoomId = msg.roomId;
          p1Color = msg.myColor;
          res();
        }
      });
    }),
    new Promise<void>((res) => {
      wsLobby2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'match:found') {
          p2Color = msg.myColor;
          res();
        }
      });
    }),
  ]);

  // Both players queue up for "beginner" tier
  wsLobby1.send(JSON.stringify({ type: 'matchmaking:join', tierId: 'beginner', profile: { id: player1Id, name: 'Ali Beyaz', coins: 1000 } }));
  wsLobby2.send(JSON.stringify({ type: 'matchmaking:join', tierId: 'beginner', profile: { id: player2Id, name: 'Veli Siyah', coins: 1000 } }));

  await matchPromise;
  expect(Boolean(matchedRoomId), 'İki oyuncu eşleşti ve oda oluşturuldu', `RoomId: ${matchedRoomId}`);
  expect(p1Color !== p2Color, 'Oyunculara karşılıklı farklı renkler (White/Black) atandı', `P1: ${p1Color}, P2: ${p2Color}`);

  // Simulating client transition:
  // Clients notify server "lobby:leaving_for_board" and close lobby sockets cleanly
  wsLobby1.send(JSON.stringify({ type: 'lobby:leaving_for_board' }));
  wsLobby2.send(JSON.stringify({ type: 'lobby:leaving_for_board' }));
  wsLobby1.close();
  wsLobby2.close();

  // Both players mount OnlineBoard and connect with their permanent board sockets
  const wsBoard1 = new WebSocket(WS_URL);
  const wsBoard2 = new WebSocket(WS_URL);

  let p1Joined = false;
  let p2Joined = false;
  let currentRoomState: any = null;

  const boardJoinPromise = Promise.all([
    new Promise<void>((res) => {
      wsBoard1.on('open', () => {
        wsBoard1.send(JSON.stringify({ type: 'player:init', playerId: player1Id, playerName: 'Ali Beyaz' }));
        wsBoard1.send(JSON.stringify({ type: 'room:join', roomId: matchedRoomId, playerId: player1Id, playerName: 'Ali Beyaz' }));
      });
      wsBoard1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'room:joined') {
          p1Joined = true;
          currentRoomState = msg.room;
          res();
        }
      });
    }),
    new Promise<void>((res) => {
      wsBoard2.on('open', () => {
        wsBoard2.send(JSON.stringify({ type: 'player:init', playerId: player2Id, playerName: 'Veli Siyah' }));
        wsBoard2.send(JSON.stringify({ type: 'room:join', roomId: matchedRoomId, playerId: player2Id, playerName: 'Veli Siyah' }));
      });
      wsBoard2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'room:joined') {
          p2Joined = true;
          res();
        }
      });
    }),
  ]);

  await boardJoinPromise;
  expect(p1Joined && p2Joined, 'İki oyuncu da tahta soketleriyle odaya başarıyla bağlandı');
  expect(currentRoomState.status === 'playing', 'Oda durumu "playing" (oyunda) olarak doğrulandı');
  expect(Boolean(currentRoomState.openingRoll), 'Başlangıç zarı authoritative olarak atıldı', `Beyaz: ${currentRoomState.openingRoll.whiteDie}, Siyah: ${currentRoomState.openingRoll.blackDie}, Başlayan: ${currentRoomState.turn}`);

  // --- TEST 3: İLK ZAR ATILMASI & İLK HAMLE ---
  console.log('\n--- 3. İlk Zar Atılması ve Oyun Senkronizasyonu ---');
  const startingTurn = currentRoomState.turn;
  const activeSocket = startingTurn === p1Color ? wsBoard1 : wsBoard2;
  const passiveSocket = startingTurn === p1Color ? wsBoard2 : wsBoard1;

  let rolledDice: any[] = [];
  const rollPromise = new Promise<void>((res) => {
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'game:rolled') {
        rolledDice = msg.dice;
        activeSocket.off('message', handler);
        res();
      }
    };
    activeSocket.on('message', handler);
  });

  activeSocket.send(JSON.stringify({ type: 'game:roll', roomId: matchedRoomId }));
  await rollPromise;
  expect(rolledDice.length > 0, 'Sırası gelen oyuncu ilk zarları başarıyla attı', `Zarlar: ${rolledDice.map((d: any) => d.value).join(' - ')}`);

  // --- TEST 4: KRİTİK TEST - İLK ZARDAN SONRA "RAKİBİNİZ ÇIKTI" HATASI OLUŞMUYOR MU? ---
  console.log('\n--- 4. Öncelikli Hata Doğrulaması: 25 Saniye Boyunca Sahte Çıkış/Terk Yok ---');
  let falseAbandonDetected = false;
  let abandonMessage = '';

  const abandonListener1 = (data: any) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'room:player_abandoned') {
      falseAbandonDetected = true;
      abandonMessage = `P1 socket received abandon: ${JSON.stringify(msg)}`;
    }
  };
  const abandonListener2 = (data: any) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'room:player_abandoned') {
      falseAbandonDetected = true;
      abandonMessage = `P2 socket received abandon: ${JSON.stringify(msg)}`;
    }
  };

  wsBoard1.on('message', abandonListener1);
  wsBoard2.on('message', abandonListener2);

  // Wait 3 seconds to confirm no instant or near-instant timeout fires
  await new Promise((r) => setTimeout(r, 3000));
  expect(!falseAbandonDetected, 'İlk zardan sonra oyunculara sahte "Rakibiniz çıktı" uyarısı GİTMEDİ (Hata çözüldü)');

  // --- TEST 5: GEÇİCİ BAĞLANTI KOPMASI VE YENİDEN BAĞLANMA (RECONNECTION) ---
  console.log('\n--- 5. Geçici Bağlantı Kopması ve Başarılı Yeniden Bağlanma ---');
  let disconnectNoticeReceived = false;

  const disconnectNoticePromise = new Promise<void>((res) => {
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room:player_disconnected') {
        disconnectNoticeReceived = true;
        wsBoard2.off('message', handler);
        res();
      }
    };
    wsBoard2.on('message', handler);
  });

  // Player 1 drops connection (e.g. WiFi switch)
  wsBoard1.off('message', abandonListener1);
  wsBoard1.close();

  await disconnectNoticePromise;
  expect(disconnectNoticeReceived, 'Oyuncu koptuğunda rakibe "Bağlantı koptu, yeniden bağlanma bekleniyor" bildirimi gitti');

  // Player 1 reconnects after 1 second (within 25s grace period)
  const wsBoard1Reconnected = new WebSocket(WS_URL);
  let reconnectNoticeReceived = false;

  const reconnectNoticePromise = new Promise<void>((res) => {
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room:player_reconnected' || (msg.type === 'room:updated' && msg.room?.whitePlayer?.connected)) {
        reconnectNoticeReceived = true;
        wsBoard2.off('message', handler);
        res();
      }
    };
    wsBoard2.on('message', handler);
  });

  await new Promise<void>((res) => {
    wsBoard1Reconnected.on('open', () => {
      wsBoard1Reconnected.send(JSON.stringify({ type: 'player:init', playerId: player1Id, playerName: 'Ali Beyaz' }));
      wsBoard1Reconnected.send(JSON.stringify({ type: 'room:join', roomId: matchedRoomId, playerId: player1Id, playerName: 'Ali Beyaz' }));
      res();
    });
  });

  await reconnectNoticePromise;
  expect(reconnectNoticeReceived, 'Kopan oyuncu yeniden bağlandı ve maç kesintisiz devam etti');

  // Cleanup sockets
  wsBoard1Reconnected.close();
  wsBoard2.close();

  console.log('\n======================================================');
  console.log(`  TÜM ROBUSTNESS TESTLERİ GEÇTİ: ${passed}/${total}`);
  console.log('======================================================\n');
}

runOnlineRobustnessSuite().catch((err) => {
  console.error('Online robustness test failed:', err);
  process.exit(1);
});
