export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    const update = await request.json();
    const msg = update.message;
    if (!msg || !msg.text) return new Response("OK");

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const userId = msg.from.id;
    const firstName = msg.from.first_name || "صاحب المحل";

    const send = (t) =>
      fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: t }),
      });

    const sb = (path, opts = {}) =>
      fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
        ...opts,
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          ...(opts.headers || {}),
        },
      });

    if (text === "/start") {
      const r = await sb(`owners?telegram_user_id=eq.${userId}`);
      const owners = await r.json();

      if (owners.length === 0) {
        const r2 = await sb("owners", {
          method: "POST",
          body: JSON.stringify({ telegram_user_id: userId, name: firstName }),
        });
        const created = await r2.json();

        await sb("branches", {
          method: "POST",
          body: JSON.stringify({
            owner_id: created[0].id,
            name: "الفرع الرئيسي",
            telegram_user_id: userId,
          }),
        });

        await send(
          "أهلاً بك في Z0 👋\n\n" +
          "تم إنشاء حسابك.\n" +
          "الفرع الافتراضي: الفرع الرئيسي\n\n" +
          "الأوامر:\n" +
          "/branches — الفروع\n" +
          "/help — مساعدة"
        );
        return new Response("OK");
      }

      await send("مرحبًا بعودتك 👋\n/branches لعرض الفروع.");
      return new Response("OK");
    }

    if (text === "/help") {
      await send(
        "الأوامر:\n" +
        "/start — تسجيل\n" +
        "/branches — قائمة الفروع\n" +
        "/help — مساعدة"
      );
      return new Response("OK");
    }

    if (text === "/branches") {
      const r = await sb(`owners?telegram_user_id=eq.${userId}`);
      const owners = await r.json();
      if (owners.length === 0) {
        await send("أرسل /start أولاً.");
        return new Response("OK");
      }

      const r2 = await sb(`branches?owner_id=eq.${owners[0].id}&select=name`);
      const branches = await r2.json();

      if (branches.length === 0) {
        await send("لا توجد فروع.");
        return new Response("OK");
      }

      const list = branches.map((b, i) => `${i + 1}. ${b.name}`).join("\n");
      await send("الفروع:\n" + list);
      return new Response("OK");
    }

    return new Response("OK");
  },
};