import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DORA MARKETPLACE";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F5F5F7",
          color: "#1D1D1F",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 24, color: "#6E6E73", marginBottom: 24 }}>
          DORA MARKETPLACE
        </div>
        <div style={{ fontSize: 78, fontWeight: 600, lineHeight: 1.05 }}>
          Tài khoản và key số giao nhanh.
        </div>
        <div style={{ fontSize: 28, color: "#6E6E73", marginTop: 32 }}>
          Tồn kho rõ ràng. Bàn giao riêng từng đơn.
        </div>
      </div>
    ),
    size,
  );
}
