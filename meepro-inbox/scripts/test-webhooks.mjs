import crypto from 'node:crypto';

const BASE_URL = 'http://127.0.0.1:8787';
const SECRET = 'meepro_webhook_secret_2026';

function signMeta(body, secret = SECRET) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

function signTikTok(body, secret = SECRET) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return hmac.digest('hex');
}

async function runTests() {
  console.log('====================================================');
  console.log('  MEEPRO WEBHOOK GATEWAY & CHANNEL ADAPTER TESTS   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`[PASS] ${name} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Meta GET Webhook Challenge Verification
  // ----------------------------------------------------
  console.log('--- 1. Webhook Challenge Verification ---');
  {
    const challengeVal = `chal_${Date.now()}`;
    const res = await fetch(
      `${BASE_URL}/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=${SECRET}&hub.challenge=${challengeVal}`
    );
    const text = await res.text();
    assert(res.status === 200 && text === challengeVal, 'Facebook GET Challenge Verification', `status: ${res.status}, challenge: ${text}`);
  }

  {
    const challengeVal = `ig_chal_${Date.now()}`;
    const res = await fetch(
      `${BASE_URL}/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${SECRET}&hub.challenge=${challengeVal}`
    );
    const text = await res.text();
    assert(res.status === 200 && text === challengeVal, 'Instagram GET Challenge Verification', `status: ${res.status}`);
  }

  {
    const challengeVal = `tt_chal_${Date.now()}`;
    const res = await fetch(
      `${BASE_URL}/api/webhooks/tiktok?challenge=${challengeVal}&token=${SECRET}`
    );
    const text = await res.text();
    assert(res.status === 200 && text === challengeVal, 'TikTok Shop GET Challenge Verification', `status: ${res.status}`);
  }

  {
    const res = await fetch(
      `${BASE_URL}/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=wrong_secret&hub.challenge=test`
    );
    assert(res.status === 403, 'Reject Invalid Verify Token Challenge', `status: ${res.status}`);
  }

  // ----------------------------------------------------
  // TEST 2: HMAC-SHA256 Signature Security
  // ----------------------------------------------------
  console.log('\n--- 2. HMAC-SHA256 Signature Security ---');
  const dummyPayload = JSON.stringify({
    object: 'page',
    entry: [
      {
        id: 'page_123',
        messaging: [
          {
            sender: { id: 'fb_user_test_sig' },
            recipient: { id: 'page_123' },
            timestamp: Date.now(),
            message: { mid: `mid.sig.${Date.now()}`, text: 'Test signature' },
          },
        ],
      },
    ],
  });

  // Valid signature
  {
    const validSig = signMeta(dummyPayload);
    const res = await fetch(`${BASE_URL}/api/webhooks/facebook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': validSig,
      },
      body: dummyPayload,
    });
    const json = await res.json();
    assert(res.status === 200 && json.ok, 'Accept Valid Meta HMAC Signature', `status: ${res.status}`);
  }

  // Tampered signature
  {
    const tamperedSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
    const res = await fetch(`${BASE_URL}/api/webhooks/facebook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': tamperedSig,
      },
      body: dummyPayload,
    });
    assert(res.status === 401, 'Reject Tampered Meta HMAC Signature', `status: ${res.status}`);
  }

  // ----------------------------------------------------
  // TEST 3: Inbound Message Ingestion Across Channels
  // ----------------------------------------------------
  console.log('\n--- 3. Multi-Channel Webhook Ingestion ---');

  // Facebook Inbound with Keyword Trigger ("ผ่อน")
  const fbExternalMid = `mid.fb.phase6.${Date.now()}`;
  const fbPayload = JSON.stringify({
    object: 'page',
    entry: [
      {
        id: 'meepro.official',
        messaging: [
          {
            sender: { id: 'fb_buyer_phase6_01' },
            recipient: { id: 'meepro.official' },
            timestamp: Date.now(),
            message: {
              mid: fbExternalMid,
              text: 'สวัสดีครับ สนใจอยากผ่อน iPhone 16 Pro Max 0% ครับ',
            },
          },
        ],
      },
    ],
  });

  {
    const res = await fetch(`${BASE_URL}/api/webhooks/facebook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signMeta(fbPayload),
      },
      body: fbPayload,
    });
    const json = await res.json();
    assert(res.status === 200 && json.processed === 1, 'Facebook Messenger Webhook Ingestion', `processed: ${json.processed}`);
  }

  // Instagram Inbound with Keyword Trigger ("ราคา")
  const igExternalMid = `mid.ig.phase6.${Date.now()}`;
  const igPayload = JSON.stringify({
    object: 'instagram',
    entry: [
      {
        id: 'meepro_store',
        messaging: [
          {
            sender: { id: 'ig_buyer_phase6_02' },
            recipient: { id: 'meepro_store' },
            timestamp: Date.now(),
            message: {
              mid: igExternalMid,
              text: 'เคส iPhone 16 ลดราคาเหลือเท่าไหร่คะ',
            },
          },
        ],
      },
    ],
  });

  {
    const res = await fetch(`${BASE_URL}/api/webhooks/instagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signMeta(igPayload),
      },
      body: igPayload,
    });
    const json = await res.json();
    assert(res.status === 200 && json.processed === 1, 'Instagram Direct Webhook Ingestion', `processed: ${json.processed}`);
  }

  // TikTok Shop Customer Chat Inbound
  const ttExternalMid = `tts.phase6.${Date.now()}`;
  const ttPayload = JSON.stringify({
    type: 1,
    shop_id: 'meepro_tiktok_shop',
    timestamp: Math.floor(Date.now() / 1000),
    data: {
      message_id: ttExternalMid,
      from_user_id: 'tt_buyer_phase6_03',
      text: 'สอบถามสินค้าบน TikTok Shop มีประกันศูนย์ไทยไหมครับ',
    },
  });

  {
    const res = await fetch(`${BASE_URL}/api/webhooks/tiktok`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tts-signature': signTikTok(ttPayload),
      },
      body: ttPayload,
    });
    const json = await res.json();
    assert(res.status === 200 && json.processed === 1, 'TikTok Shop Customer Chat Webhook Ingestion', `processed: ${json.processed}`);
  }

  // ----------------------------------------------------
  // TEST 4: Deduplication & Idempotency
  // ----------------------------------------------------
  console.log('\n--- 4. Idempotency & Deduplication ---');
  {
    // Resend identical Facebook payload with same mid
    const res = await fetch(`${BASE_URL}/api/webhooks/facebook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signMeta(fbPayload),
      },
      body: fbPayload,
    });
    const json = await res.json();
    assert(res.status === 200 && json.processed === 0, 'Deduplicate Redelivered Webhook', `processed: ${json.processed} (0 expected)`);
  }

  // ----------------------------------------------------
  // TEST 5: Outbound Send API & 24-Hour Policy Window
  // ----------------------------------------------------
  console.log('\n--- 5. Outbound Send API & 24-Hour Window Policy ---');
  {
    // Outbound send to demo-2 (which received a fresh inbound reply in Phase 5)
    const sendPayload = JSON.stringify({
      conversation_id: 'demo-2',
      body: 'ยินดีให้บริการครับ ทางเราได้เตรียมข้อมูลการผ่อนชำระไว้ให้เรียบร้อยแล้วครับ',
    });

    const res = await fetch(`${BASE_URL}/api/channels/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'oai-authenticated-user-id': 'owner-org-meepro',
      },
      body: sendPayload,
    });
    const json = await res.json();
    assert(res.status === 200 && json.ok, 'Outbound Send Within 24-Hour Window', `status: ${res.status}, ext_id: ${json.external_id}`);
  }

  {
    // Outbound send to demo-6 (an old closed conversation with updated_at from 2026-09-17)
    const oldPayload = JSON.stringify({
      conversation_id: 'demo-6',
      body: 'สวัสดีครับ ทักทายหลังจากผ่านไป 24 ชั่วโมง',
    });

    const res = await fetch(`${BASE_URL}/api/channels/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'oai-authenticated-user-id': 'owner-org-meepro',
      },
      body: oldPayload,
    });
    const json = await res.json();
    assert(res.status === 403 && json.code === 'POLICY_WINDOW_EXPIRED', 'Enforce 24-Hour Window Expiration Block', `status: ${res.status}, code: ${json.code}`);
  }

  console.log('\n====================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
