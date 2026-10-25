import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';

function log(step: string, status: 'PASS' | 'FAIL' | 'INFO', detail?: string) {
  const symbol = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
  console.log(`${symbol} [${status}] ${step}${detail ? `: ${detail}` : ''}`);
}

async function runTestSuite() {
  console.log('\n=============================================');
  console.log('   KLASİK TAVLA - TEST SENARYOLARI (2 OYUNCU)');
  console.log('=============================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function expect(cond: boolean, name: string, detail?: string) {
    totalTests++;
    if (cond) {
      passedTests++;
      log(name, 'PASS', detail);
    } else {
      log(name, 'FAIL', detail);
      throw new Error(`Test Failed: ${name} - ${detail || ''}`);
    }
  }

  // --- TEST 1: REKLAM ÖDÜLÜ & SINIRSIZ İZLEME KANIT DOĞRULAMASI ---
  console.log('\n--- 1. Reklam Alanı & Sunucu Doğrulama Testi ---');
  const testUserId = `test_user_${Date.now()}`;

  // Claim 1st ad
  const token1 = `proof_token_1_${Date.now()}`;
  const resAd1 = await fetch(`${BASE_URL}/api/coins/claim-ad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: testUserId, adProof: token1 }),
  });
  const dataAd1 = await resAd1.json();
  expect(resAd1.status === 503 && dataAd1.code === 'COIN_ECONOMY_TEMPORARILY_DISABLED', 'Reklam ödülü güvenlik doğrulaması bitene kadar kapalı');
  expect(!dataAd1.success, 'Doğrulanmamış reklam kanıtı jeton üretmedi');

  // Replay attack with same token
  const resReplay = await fetch(`${BASE_URL}/api/coins/claim-ad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: testUserId, adProof: token1 }),
  });
  expect(resReplay.status === 503, 'Reklam ödülü endpointi güvenlik nedeniyle kapalı');

  // Claim 2nd ad (succeeds, no daily limit)
  const resAd2 = await fetch(`${BASE_URL}/api/coins/claim-ad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: testUserId, adProof: `proof_token_2_${Date.now()}` }),
  });
  expect(resAd2.status === 503, 'İkinci reklam isteği jeton üretemedi');

  // Claim 3rd ad (succeeds, no daily limit)
  const resAd3 = await fetch(`${BASE_URL}/api/coins/claim-ad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: testUserId, adProof: `proof_token_3_${Date.now()}` }),
  });
  expect(resAd3.status === 503, 'Üçüncü reklam isteği jeton üretemedi');

  // Status check should reflect unlimited ads available
  const statusRes = await fetch(`${BASE_URL}/api/coins/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: testUserId }),
  });
  const statusData = await statusRes.json();
  expect(statusData.adsRemainingToday === 0 && statusData.coinEconomyEnabled === false, 'Jeton ekonomisi kapalı olarak raporlandı');

  // --- TEST 2: ARKADAŞ ODASI OLUŞTURMA & İPTAL/İADE ---
  console.log('\n--- 2. Oda Oluşturma & Maç Öncesi İptal/İade Testi ---');
  const ws1 = new WebSocket(WS_URL);
  const player1 = { id: `p1_${Date.now()}`, name: 'Ahmet Beyaz', coins: 1500 };

  await new Promise<void>((resolve) => {
    ws1.on('open', () => {
      ws1.send(JSON.stringify({ type: 'player:init', playerId: player1.id, playerName: player1.name }));
      resolve();
    });
  });

  let room1InviteCode = '';
  let room1Id = '';

  const cancelPromise = new Promise<void>((resolve) => {
    const cancelHandler = async (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'friend_room:created') {
        room1InviteCode = msg.inviteCode;
        room1Id = msg.roomId;
        expect(msg.entryFee === 200, '200 jetonluk arkadaş odası başarıyla kuruldu', `Kod: ${msg.inviteCode}`);
        expect(msg.prizePool === 400, 'Ödül havuzu doğru hesaplandı (400 jeton)');

        // Test cancel
        ws1.send(JSON.stringify({ type: 'friend_room:cancel', roomId: room1Id }));
      } else if (msg.type === 'friend_room:cancelled') {
        expect(msg.refundedFee === 200, 'Oda iptal edildi ve 200 jeton iade bildirimi alındı');
        ws1.off('message', cancelHandler);
        resolve();
      }
    };
    ws1.on('message', cancelHandler);
  });

  ws1.send(JSON.stringify({ type: 'friend_room:create', entryFee: 200, profile: player1 }));
  await cancelPromise;

  // Verify cancelled room cannot be queried
  const infoAfterCancel = await fetch(`${BASE_URL}/api/friend-room/info?code=${room1InviteCode}`);
  expect(infoAfterCancel.status === 404, 'İptal edilen oda arandığında 404 döndü (aktifleştirilmedi)');

  // --- TEST 3: İKİ OYUNCU EŞLEŞMESİ & MAÇ OYNAMA ---
  console.log('\n--- 3. İki Farklı Oyuncu ile Oda Kurma & Katılma Testi ---');
  const ws2 = new WebSocket(WS_URL);
  const player2 = { id: `p2_${Date.now()}`, name: 'Mehmet Siyah', coins: 2000 };

  await new Promise<void>((resolve) => {
    ws2.on('open', () => {
      ws2.send(JSON.stringify({ type: 'player:init', playerId: player2.id, playerName: player2.name }));
      resolve();
    });
  });

  let activeInviteCode = '';
  let activeRoomId = '';

  const createPromise = new Promise<void>((resolve) => {
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'friend_room:created') {
        activeInviteCode = msg.inviteCode;
        activeRoomId = msg.roomId;
        ws1.off('message', handler);
        resolve();
      }
    };
    ws1.on('message', handler);
  });

  // Create 500 coin room
  ws1.send(JSON.stringify({ type: 'friend_room:create', entryFee: 500, profile: player1 }));
  await createPromise;
  expect(Boolean(activeInviteCode), '500 Jetonluk özel oda kuruldu', `Kod: ${activeInviteCode}`);

  // Query Room Info endpoint
  const roomInfoRes = await fetch(`${BASE_URL}/api/friend-room/info?code=${activeInviteCode}`);
  expect(roomInfoRes.status === 200, 'Davet koduyla oda bilgisi sorgulandı');
  const roomInfo = await roomInfoRes.json();
  expect(roomInfo.entryFee === 500, 'Oda giriş ücreti 500 jeton olarak doğrulandı');
  expect(roomInfo.prizePool === 1000, 'Toplam ödül 1000 jeton olarak doğrulandı');
  expect(roomInfo.creatorName === player1.name, `Oda sahibi adı doğru: ${player1.name}`);

  // Self-match security test: Player 1 tries to join their own room
  const selfMatchPromise = new Promise<void>((resolve) => {
    const selfHandler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'error') {
        expect(msg.message.includes('kendi') || msg.message.includes('katılamazsınız'), 'Kendi odasına katılma girişimi engellendi');
        ws1.off('message', selfHandler);
        resolve();
      }
    };
    ws1.on('message', selfHandler);
    ws1.send(JSON.stringify({ type: 'friend_room:join', inviteCode: activeInviteCode, profile: player1 }));
  });
  await selfMatchPromise;

  // Deduct fee for both players
  const deductP1 = await fetch(`${BASE_URL}/api/match/deduct-fee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: player1.id, roomId: activeRoomId, entryFee: 500 }),
  });
  expect(deductP1.status === 503, 'Player 1 giriş ücreti güvenlik nedeniyle devre dışı');

  const deductP2 = await fetch(`${BASE_URL}/api/match/deduct-fee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: player2.id, roomId: activeRoomId, entryFee: 500 }),
  });
  expect(deductP2.status === 503, 'Player 2 giriş ücreti güvenlik nedeniyle devre dışı');

  // Player 2 joins with code
  let p1Matched = false;
  let p2Matched = false;

  const matchPromise = new Promise<void>((resolve) => {
    ws1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'friend_room:matched') {
        p1Matched = true;
        if (p1Matched && p2Matched) resolve();
      }
    });

    ws2.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'friend_room:matched' || msg.type === 'room:joined') {
        p2Matched = true;
        if (p1Matched && p2Matched) resolve();
      }
    });

    ws2.send(JSON.stringify({ type: 'friend_room:join', inviteCode: activeInviteCode, profile: player2 }));
  });

  await matchPromise;
  expect(p1Matched && p2Matched, 'İki oyuncu karşılıklı aynı odaya başarıyla bağlandı');

  // --- TEST 4: ÖDÜL DAĞITIMI & ÇİFT ÖDÜL ENGELLEME ---
  console.log('\n--- 4. Kazanan Ödülü (1000 Jeton) & Mükerrer Ödül Koruması ---');
  const awardPrizeRes = await fetch(`${BASE_URL}/api/match/award-prize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: player1.id, roomId: activeRoomId, prizeAmount: 1000 }),
  });
  expect(awardPrizeRes.status === 503, 'Ödül dağıtımı güvenlik nedeniyle devre dışı');

  // Attempt duplicate prize claim
  const duplicatePrizeRes = await fetch(`${BASE_URL}/api/match/award-prize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: player1.id, roomId: activeRoomId, prizeAmount: 1000 }),
  });
  expect(duplicatePrizeRes.status === 503, 'Ödül endpointi güvenlik nedeniyle kapalı');

  ws1.close();
  ws2.close();

  console.log('\n=============================================');
  console.log(`  TÜM TESTLER BAŞARIYLA TAMAMLANDI: ${passedTests}/${totalTests}`);
  console.log('=============================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
