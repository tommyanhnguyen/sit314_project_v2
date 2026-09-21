# Checklist tiếp theo: ShelfSense final project

Đây là danh sách sau audit, chưa phải bằng chứng hoàn thành. Dùng đề gốc, plan và feedback tutor trong `FINAL_PROJECT_AUDIT.md` làm nguồn. Các mục không được tự coi là hoàn thành khi chỉ có code.

## Ưu tiên 1: Yêu cầu bắt buộc của đề:

| Hạng mục | Điều kiện đủ để đánh dấu hoàn thành |
| --- | --- |
| Deploy lên AWS | Có revision code, sơ đồ triển khai thực tế, service đang chạy và một giao dịch đầu cuối qua cloud |
| Automatic scaling microservice | Có baseline cố định, tăng workload, policy tự tăng replicas và tự giảm khi hết tải |
| So sánh hiệu năng theo feedback | Cùng workload và tuyến đo. Có latency p50/p95, throughput xử lý thành công, CPU, memory, queue depth và số task trước/sau |
| AWS/CloudWatch evidence | Mốc giờ thống nhất, biểu đồ và log khớp cùng lần chạy. Ghi cấu hình, số event, lỗi và event bị mất hoặc trùng |
| Secure deployment | Chứng minh TLS, device identity, service permissions và API/store access. Kiểm tra request sai quyền bị từ chối |
| Evaluation và final submission | Giải thích scalability, tradeoffs, giới hạn. Kiểm tra đề 6.3D hiện hành trước khi chuẩn bị file upload |

## Ưu tiên 2: Cam kết plan hỗ trợ các yêu cầu trên:

1. Giải quyết A1 và A3, để lỗi ghi dữ liệu hoặc publish không làm event mất vĩnh viễn. Acceptance: inject lỗi ở từng bước, restart và replay, stock/order/output cuối cùng đúng và không lặp.
2. Giải quyết A2, để restart Node-RED không tạo opening stock lần hai. Acceptance: cùng số đo trước/sau restart cho cùng lượng hàng.
3. Giải quyết A4 và A7 trước khi tăng replicas. Acceptance: hai process nhận cùng approval chỉ tạo một delivery; event không gây mất hoặc trùng stock; velocity đúng với fixture đã tính tay.
4. Chạy contract tests trên MongoDB thật. MemoryStore và stub của Mongo không chứng minh transaction, index race hoặc concurrency trên database.
5. Chạy lại stack local từ Docker và kiểm tra full loop, invalid messages, portal approval, delivery completion. Ghi rõ database ban đầu và không trộn dữ liệu cũ với POS ID mới.
6. Chuẩn bị workload 2 tới 20 stores, mục tiêu 50 shelves mỗi store và burst 10× theo plan. Giữ cùng seed, thời lượng, warmup và cách đo giữa các cấu hình. Ghi resource limits và chi phí.
7. Đo stock latency dưới 3 giây và cold chain alert dưới 5 giây qua toàn tuyến. Không dùng sensor time nén trong demo làm thời gian thực nghiệm.
8. Kiểm tra các commitment Atlas, ALB, S3/CloudFront, signed events, role access và retention. Nếu thay giải pháp, ghi lý do và xác nhận thay đổi plan trước khi tuyên bố đạt.
9. Xác nhận tutor đã chấp thuận delivery một stop và portal tối thiểu. Nếu chưa, giữ trạng thái reduced scope pending approval.
10. Viết final report từ evidence mới. Không dùng 4.2D làm bằng chứng cho trạng thái runtime hiện tại. Availability 99.9% vẫn là target nếu không có phép đo đủ thời gian.

## Ưu tiên 3: Optional enhancement:

Hardware demo, portal đẹp hơn và thuật toán routing nâng cao không giải quyết phần AWS evidence còn thiếu. Chưa triển khai các phần này. Chỉ cân nhắc sau khi core requirements đạt và người dùng duyệt scope.

## Bộ evidence cần giữ:

1. Revision code và cấu hình workload của từng run.
2. Sơ đồ kiến trúc triển khai thực tế.
3. CloudWatch trước scaling, trong scaling và sau scaling.
4. Latency, throughput thành công, CPU, memory, queue depth, task count và lỗi của cùng run.
5. Giao dịch đầu cuối cùng event ID để nối sensor, stock, order và delivery.
6. Kết quả negative security tests và recovery tests.
7. Quyết định tutor về phần scope bị giảm.
8. Log cleanup và tài nguyên còn lại sau experiment.

Evidence cá nhân tiếp tục ở folder Git ignore. Engineering audit và checklist có thể review trên branch local. Việc triển khai cloud, push và nộp bài chưa được thực hiện trong audit này.
