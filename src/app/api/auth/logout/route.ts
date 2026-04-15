export async function POST() {
  const clear = (name: string) =>
    `${name}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;

  const res = Response.json({ message: "Logged out" });
  res.headers.append("Set-Cookie", clear("access_token"));
  res.headers.append("Set-Cookie", clear("id_token"));
  res.headers.append("Set-Cookie", clear("refresh_token"));
  return res;
}
