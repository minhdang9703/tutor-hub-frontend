# TutorHub Frontend

Giao diện web cho nền tảng kết nối gia sư và phụ huynh, dựng theo hợp đồng API của backend Spring Boot (`/api/v1`).

Stack: **React 19 + Vite + TypeScript + Tailwind CSS v4**, TanStack Query, React Router, Axios.

## Chạy development

```bash
npm install
cp .env.example .env      # sửa VITE_API_PROXY_TARGET nếu backend không ở localhost:8080
npm run dev               # http://localhost:5173
```

Vite proxy chuyển mọi request `/api/*` sang backend nên frontend không cần cấu hình CORS.
Đổi đích proxy bằng `VITE_API_PROXY_TARGET` trong `.env` (VD: `http://192.168.1.5:8080`).

Backend cần chạy Postgres + MinIO + Mailpit (xem `docker-compose.yml` phía backend) và Spring Boot ở cổng 8080.
Mailpit (`http://localhost:8025`) là nơi đọc email xác minh / đặt lại mật khẩu khi dev.

## Build

```bash
npm run build     # typecheck + bundle vào dist/
npm run preview
```

## Cấu trúc

```
src/
  api/         types.ts (DTO khớp schema V1), client.ts (axios + JWT refresh), auth/tutor/parent/booking/catalog.ts
  auth/        AuthContext (access/refresh token), ProtectedRoute theo role
  components/  ui.tsx (Button/Input/Select/Card/Badge/...), AppLayout.tsx, ErrorBoundary.tsx
  lib/         format.ts (tiền VNĐ, ngày giờ VN), labels.ts (nhãn tiếng Việt + tông màu badge)
  pages/
    tutor/              trang công khai: danh sách + chi tiết gia sư, dialog đặt lịch
    tutor/dashboard/    hồ sơ gia sư: thông tin, môn dạy, lịch rảnh, giấy tờ, tài khoản
    parent/             hồ sơ phụ huynh + quản lý con
    booking/            lịch học của hai phía, đánh giá, đặt lịch lặp lại
    auth/               đăng nhập, đăng ký, xác minh email, quên/đặt lại mật khẩu
docs/          V1__init_schema.sql, V2__seed_reference_data.sql — bản sao schema để đối chiếu
```

## Quy ước đã áp dụng theo backend

- **Không có DTO giả**: mọi kiểu trong `src/api/types.ts` map thẳng từ `V1__init_schema.sql` và danh sách API;
  `search_vector`, `rating_avg/rating_count` chỉ để đọc.
- **Token**: access 15 phút + refresh 14 ngày lưu ở `localStorage`. Axios interceptor tự gọi
  `POST /auth/refresh` khi gặp 401 (mutex để nhiều request song song chỉ refresh một lần), retry đúng một lần,
  và đăng xuất khi refresh thất bại.
- **Lỗi nghiệp vụ**: backend trả `{ code, message, details, timestamp }`. `ApiClientError` giữ nguyên `code`
  (VD `BOOKING_OVERLAP`) để UI ánh xạ sang thông báo tiếng Việt; mutation error tự toast toàn cục.
- **Phân quyền UI**: route guard theo role `PARENT` / `TUTOR` / `ADMIN` chỉ là lớp UX — quyền thật
  (kể cả quyền sở hữu tài nguyên) do backend kiểm tra.
- **Booking**: nút thao tác hiện theo đúng state machine
  `PENDING → CONFIRMED → COMPLETED | CANCELLED | NO_SHOW`; trùng lịch xử lý bằng 409.
- **Tiền & thời gian**: tiền là số nguyên VNĐ, thời gian ISO UTC hiển thị theo locale `vi-VN`.

## Việc còn lại

Nhóm API `REQUEST`/`APPLICATION` (đăng yêu cầu tìm gia sư, ứng tuyển), `CHAT`, `NOTIFICATION`, `REPORT`
và khu vực `ADMIN` (duyệt hồ sơ, khóa tài khoản, thống kê) chưa làm. Chat WebSocket chờ backend Giai đoạn 5+.
