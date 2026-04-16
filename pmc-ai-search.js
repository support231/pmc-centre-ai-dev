export default async (request, context) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";

  if (!query) {
    return new Response(
      JSON.stringify({ error: "Missing 'query' in request body" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const answer = `You said: ${query}`;

  return new Response(
    JSON.stringify({ answer }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
