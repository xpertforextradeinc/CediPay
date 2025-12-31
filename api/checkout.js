export default async function handler(req, res) {
  try {
    const secret = process.env.XGS_DODO_SECRET_KEY;

    if (!secret) {
      return res.status(500).json({ error: "Missing API key" });
    }

    // Example: Forward the request to Dodo API
    const response = await fetch("https://api.dodo.dev/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: "Server error", details: error.message });
  }
}
