export async function onRequestGet() {
  const url =
    "https://script.google.com/macros/s/AKfycbwhinuB6R-rxHMG4lSkilihzVcFUrGXOQNbhYLrNQfksn-Yy5nxOPFyaUNnRhlpIhRGhw/exec?mode=json&action=sync";

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json; charset=UTF-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Unable to run the fleet synchronization.",
      detail: error instanceof Error ? error.message : String(error)
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      }
    });
  }
}
