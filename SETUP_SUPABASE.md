# Kết nối Supabase (tài khoản, Lookbook đồng bộ, thống kê)

Khi `config.js` còn để trống, site vẫn chạy bình thường ở chế độ khách: không có nút đăng nhập, không thu thập dữ liệu. Làm theo các bước dưới đây để bật tài khoản và thống kê. Mất khoảng 10 phút.

## 1. Tạo project Supabase (miễn phí)
1. Vào https://supabase.com, chọn **Start your project**, đăng nhập bằng GitHub.
2. Bấm **New project** và điền:
   - **Name:** `viet-phuc-remix`
   - **Database password:** bấm Generate và lưu lại ở chỗ an toàn. Không gửi mật khẩu này cho ai.
   - **Region:** `Southeast Asia (Singapore)`, gần Việt Nam nhất.
3. Đợi khoảng 2 phút cho project khởi tạo xong.

## 2. Tạo bảng dữ liệu
1. Ở menu trái, vào **SQL Editor** rồi bấm **New query**.
2. Mở file [`supabase/schema.sql`](supabase/schema.sql), copy toàn bộ, dán vào và bấm **Run**.
3. Thấy dòng "Success. No rows returned" là xong. File này chạy lại nhiều lần cũng không sao.

## 3. Cấu hình đăng nhập
Vào **Authentication → URL Configuration**:
- **Site URL:** `https://dwind-source.github.io/viet-phuc-remix/`
- **Redirect URLs**, bấm Add URL và thêm:
  - `https://dwind-source.github.io/viet-phuc-remix/**`
  - `http://localhost:8000/**` (để test trên máy)

Vào **Authentication → Sign In / Providers → Email** và chọn một trong hai cách:
- **Cách nhanh để ra mắt (khuyến nghị lúc đầu):** tắt **Confirm email**. Người dùng đăng ký xong là vào được ngay.
  - Lý do: email mặc định của Supabase chỉ gửi được tới thành viên trong team project của bạn, tối đa 2 email/giờ, nên người dùng thật sẽ không nhận được email xác nhận.
- **Cách chuẩn production:** giữ **Confirm email** và cấu hình SMTP riêng ở **Authentication → Emails → SMTP Settings**.
  - Có thể dùng Brevo, Resend hoặc SendGrid; các dịch vụ này đều có gói miễn phí.
  - Cách này cũng cần thiết nếu muốn tính năng **Quên mật khẩu** hoạt động cho người dùng thật.

## 4. Lấy khóa kết nối
Vào **Project Settings → API Keys** (hoặc bấm nút **Connect** ở trên cùng) và copy 2 giá trị:
- **Project URL**, dạng `https://xxxxxxxx.supabase.co`
- **anon public** key hoặc **Publishable key** (`sb_publishable_…`)

Hai giá trị này được thiết kế để công khai trong trình duyệt. Dữ liệu được bảo vệ bằng Row Level Security trong `schema.sql`.

⚠️ **Tuyệt đối không** dùng `service_role` key hay `secret` key. Hai key này có toàn quyền với database.

Điền 2 giá trị vào [`config.js`](config.js) rồi push lên GitHub:
```js
window.VPR_CONFIG = {
  supabaseUrl: 'https://xxxxxxxx.supabase.co',
  supabaseAnonKey: 'sb_publishable_...'
};
```
Khoảng 1–2 phút sau, site sẽ có nút **Đăng nhập** và banner xin phép thu thập dữ liệu.

## 5. Cấp quyền admin cho bạn
1. Lên site, bấm **Đăng nhập → Tạo tài khoản** bằng email của bạn.
2. Trong Supabase, vào **SQL Editor** và chạy lệnh sau, thay bằng email của bạn:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'email-cua-ban@gmail.com';
   ```
3. Mở `https://dwind-source.github.io/viet-phuc-remix/admin.html` để xem thống kê. Bạn cũng có thể vào từ **Tài khoản → Mở trang quản trị**.

## Dữ liệu được lưu ở đâu
| Bảng | Nội dung | Ai đọc được |
|---|---|---|
| `profiles` | Tên hiển thị, ngôn ngữ, lựa chọn chia sẻ dữ liệu | Chính chủ, admin |
| `looks` | Lookbook đã đồng bộ | Chính chủ, admin |
| `events` | Thao tác sử dụng (chỉ khi người dùng bấm Đồng ý) | Chỉ admin |
| `admins` | Danh sách admin | Chỉ chỉnh được trong SQL Editor |

Bạn cũng có thể xem trực tiếp trong Supabase ở mục **Table Editor**, hoặc tải CSV từ trang admin.
