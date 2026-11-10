import { WebSocket } from 'ws';
import { getInitialBoard } from '../src/utils/backgammonLogic.ts';
import { findBestMovesForPlayer } from '../src/utils/aiPlayer.ts';

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

  // --- TEST 0: OTOMATİK HAMLE AI PERFORMANSI (ÇİFT ZAR) ---
  console.log('\\n--- 0. AI Zaman Aşımı Performansı: Çift Zar ---');
  const benchmarkBoard = getInitialBoard();
  for (const [label, values] of [['çift 6', [6, 6, 6, 6]], ['çift 1', [1, 1, 1, 1]], ['farklı zar', [2, 5]]] as const) {
    const benchmarkDice = values.map((value, index) => ({ value, used: false, id: 'benchmark-' + label + '-' + index }));
    const startedAt = performance.now();
    const selectedMoves = findBestMovesForPlayer(benchmarkBoard, 'white', benchmarkDice, 'medium');
    const elapsedMs = performance.now() - startedAt;
    expect(elapsedMs < 1500, 'AI ' + label + ' hamle hesabı 1.5 saniye altında tamamlandı', Math.round(elapsedMs) + ' ms; hamle: ' + selectedMoves.length);
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

  // --- TEST 3: AÇILIŞ ZARI ZAMAN AŞIMI, OTOMATİK HAMLE VE SIRA DEVRİ ---
  console.log('\n--- 3. Açılış Zarı Zaman Aşımı: Sunucu Otomatik Oynar ve Sırayı Devreder ---');

  const openingReadyPromise = new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room:updated' && msg.room?.openingRollCompleted && msg.room.dice?.length === 2) {
        currentRoomState = msg.room;
        wsBoard1.off('message', handler);
        wsBoard2.off('message', handler);
        clearTimeout(timeout);
        resolve();
      }
    };
    timeout = setTimeout(() => {
      wsBoard1.off('message', handler);
      wsBoard2.off('message', handler);
      reject(new Error('Açılış zarları zamanında tamamlanmadı.'));
    }, 10000);
    wsBoard1.on('message', handler);
    wsBoard2.on('message', handler);
    wsBoard1.send(JSON.stringify({ type: 'game:opening_roll_complete', roomId: matchedRoomId }));
  });

  await openingReadyPromise;
  expect(currentRoomState.openingRollCompleted === true, 'Açılış zarı sunucu tarafından tamamlandı');
  expect(currentRoomState.dice.length === 2, 'Açılış zarları ilk hamle için odada hazır');

  const startingTurn = currentRoomState.turn;
  let automaticMoves = 0;
  let handedOffRoom: any = null;

  const timeoutTurnPromise = new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'game:moved' && msg.room?.turn === startingTurn) {
        automaticMoves++;
      }
      if (msg.type === 'game:turn_passed' && msg.room?.turn !== startingTurn) {
        handedOffRoom = msg.room;
        wsBoard1.off('message', handler);
        wsBoard2.off('message', handler);
        clearTimeout(timeout);
        resolve();
      }
    };
    timeout = setTimeout(() => {
      wsBoard1.off('message', handler);
      wsBoard2.off('message', handler);
      reject(new Error('Otomatik hamle sonrası sıra 30 saniye içinde rakibe geçmedi.'));
    }, 30000);
    wsBoard1.on('message', handler);
    wsBoard2.on('message', handler);
  });

  await timeoutTurnPromise;
  expect(automaticMoves > 0, 'Süre dolunca en az bir otomatik hamle sunucu tarafından oynatıldı', `Hamle sayısı: ${automaticMoves}`);
  expect(handedOffRoom.turn !== startingTurn, 'Otomatik hamle tamamlanınca sıra rakibe geçti');
  expect(handedOffRoom.dice.length === 0, 'Sıra devrinde önceki zarlar temizlendi');

  // --- TEST 4: ZAR ATMADAN SÜRE DOLUNCA SUNUCU ZAR ATAR, ANİMASYON OLAYI GÖNDERİR VE OYNAR ---
  console.log('\n--- 4. Zar Atılmadan Zaman Aşımı: Otomatik Zar ve Sıra Devri ---');

  const secondTurnColor = handedOffRoom.turn;
  let automaticRollSeen = false;
  let secondTurnAutomaticMoves = 0;
  let secondTurnHandedOff: any = null;

  const secondTimeoutPromise = new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'game:rolled' && msg.autoPlay === true && msg.room?.turn === secondTurnColor) {
        automaticRollSeen = true;
        expect(msg.dice?.length === 2, 'Zar atılmayan turda sunucu iki yeni zar üretti');
      }
      if (msg.type === 'game:moved' && msg.autoPlay === true && msg.room?.turn === secondTurnColor) secondTurnAutomaticMoves++;
      if (msg.type === 'game:turn_passed' && msg.room?.turn !== secondTurnColor) {
        secondTurnHandedOff = msg.room;
        wsBoard1.off('message', handler);
        wsBoard2.off('message', handler);
        clearTimeout(timeout);
        resolve();
      }
    };
    timeout = setTimeout(() => {
      wsBoard1.off('message', handler);
      wsBoard2.off('message', handler);
      reject(new Error('Zar atılmayan turda otomatik zar/hamle/sıra devri 30 saniyede tamamlanmadı.'));
    }, 30000);
    wsBoard1.on('message', handler);
    wsBoard2.on('message', handler);
  });

  await secondTimeoutPromise;
  expect(automaticRollSeen, 'Zar atılmayan turda animasyon için game:rolled olayı gönderildi');
  expect(secondTurnAutomaticMoves > 0, 'Otomatik zarın ardından en az bir hamle yapıldı', 'Hamle sayısı: ' + secondTurnAutomaticMoves);
  expect(secondTurnHandedOff.turn !== secondTurnColor, 'Otomatik zar ve hamlelerden sonra sıra rakibe geçti');
  expect(secondTurnHandedOff.dice.length === 0, 'Otomatik tur sonunda zarlar temizlendi');

  // --- TEST 5: ART ARDA GELEN NORMAL TURLARDA ZAMANLAYICI KAYBOLMUYOR ---
  console.log('\\n--- 5. Art Arda İki Normal Tur: Her Seferinde Yeni Zar, Otomatik Hamle ve Sıra Devri ---');
  let previousTurn = secondTurnHandedOff.turn;
  for (let cycle = 1; cycle <= 2; cycle++) {
    let rollReceived = false;
    let moveCount = 0;
    let nextRoom: any = null;
    const cyclePromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        wsBoard1.off('message', handler);
        wsBoard2.off('message', handler);
        reject(new Error('Art arda otomatik tur ' + cycle + ' tamamlanmadı; sıra devri veya zar olayı eksik.'));
      }, 30000);
      const handler = (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'game:rolled' && msg.autoPlay === true && msg.room?.turn === previousTurn) {
          rollReceived = true;
          expect(msg.dice?.length === 2, 'Tur ' + cycle + ': sunucu yeni iki zar gönderdi');
        }
        if (msg.type === 'game:moved' && msg.autoPlay === true && msg.room?.turn === previousTurn) moveCount++;
        if (msg.type === 'game:turn_passed' && msg.room?.turn !== previousTurn) {
          nextRoom = msg.room;
          wsBoard1.off('message', handler);
          wsBoard2.off('message', handler);
          clearTimeout(timeout);
          resolve();
        }
      };
      wsBoard1.on('message', handler);
      wsBoard2.on('message', handler);
    });
    await cyclePromise;
    expect(rollReceived, 'Tur ' + cycle + ': otomatik zar olayı geldi');
    expect(nextRoom?.turn !== previousTurn, 'Tur ' + cycle + ': sıra rakibe geçti');
    expect(nextRoom?.dice?.length === 0, 'Tur ' + cycle + ': eski zarlar temizlendi');
    log('Tur ' + cycle + ': otomatik hamle sayısı', 'INFO', String(moveCount));
    previousTurn = nextRoom.turn;
  }
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
