/* eslint-disable @next/next/no-img-element */
export default function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img src={url} alt={name} width={size} height={size}
        className="rounded-full object-cover" style={{ width: size, height: size }} />
    );
  }
  // ไม่มีรูป → แสดงตัวอักษรแรกของชื่อ
  return (
    <div className="flex items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700"
      style={{ width: size, height: size }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}