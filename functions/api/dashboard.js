export async function onRequestGet() {
  const url =
    "https://script.google.com/macros/s/AKfycbwhinuB6R-rxHMG4lSkilihzVcFUrGXOQNbhYLrNQfksn-Yy5nxOPFyaUNnRhlpIhRGhw/exec?mode=json";

  const response = await fetch(url, { redirect: "follow" });
  const text = await response.text();

  return new Response(text, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
