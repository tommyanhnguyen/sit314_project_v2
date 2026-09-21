# Audit final project: ShelfSense

Ngày kiểm tra: 22/09/2026. Repo chính: `sit314_project_v2`. Branch: `audit/final-project-2026-09-22`. Điểm bắt đầu: `61b7e00` trên `review-fixes`. V3 chỉ dùng để đối chiếu.

## Kết luận:

Project có phần lớn chức năng local của tuần 2 đến tuần 5 trong plan 9 tuần. Một phần hardening của tuần 8 cũng đã làm. Chưa đủ bằng chứng để gọi final project hoàn thành. Các yêu cầu bắt buộc về triển khai AWS, automatic scaling và secure deployment chưa được chứng minh trong repo hoặc tài liệu đã kiểm tra.

Không quy đổi thành phần trăm hoàn thành. Các tuần có khối lượng khác nhau. Ba phần đánh giá quan trọng vẫn nằm ở AWS và bằng chứng thực nghiệm. Bộ test đạt không đồng nghĩa đã hoàn thành plan.

Bản audit này xác nhận code và tài liệu local. Không kiểm tra AWS account hay trạng thái OnTrack hiện tại. Không triển khai cloud, push GitHub hoặc nộp bài.

## Nguồn và độ tin cậy:

1. Đề gốc `SIT314-1.2D.pdf`, 2 trang: khôi phục bản trích xuất từ phiên ngày 12/09/2026, mã `01a095bf-b3b6-7901-94ec-db2c52a495db`, output dòng 260. PDF tại đường dẫn Downloads cũ đã mất. Nội dung yêu cầu được đọc từ bản trích xuất cũ, không phải tải lại OnTrack hiện tại.
2. Plan đã cung cấp trước đây: `Downloads/1966798/sit314_project_plan.pdf`, 5 trang. Nội dung cũng được khôi phục từ output trên. Bản local `../sit314_module1/common/distinction_plan_supermarket.pdf` có cùng nội dung các mục và plan 9 tuần đã đọc. `distinction_plan.pdf` là bản trình bày khác của cùng đề tài. Chưa kiểm tra đồng nhất nhị phân giữa các PDF.
3. Feedback tutor ngày 30/07/2026: khôi phục ảnh gốc từ tin nhắn người dùng trong phiên trên. Ảnh thể hiện task đã Complete. Tutor yêu cầu so sánh trước và sau scaling bằng latency, throughput, resource utilisation, cùng AWS và CloudWatch evidence.
4. `/Users/tommyanh/Downloads/4.2D.pdf`: đọc đủ 5 trang trong lần audit này. Đây là báo cáo status đã nộp, có trang bìa OnTrack. Đây không phải đề bài final hay feedback chấp thuận giảm scope.
5. Thiết kế local: `../docs/superpowers/specs/2026-09-13-shelfsense-v2-local-complete-design.md`. Dùng để giải thích phạm vi local trước đây. Không dùng để loại bỏ cam kết trong plan gốc.
6. Code V2, test thực chạy và code V3. Không dùng số test hoặc số throughput trong tài liệu cũ thay cho kết quả mới.

Bản trích xuất gốc và ảnh feedback đã được lưu local trong `report_evidence/final-audit-2026-09-22/`. Folder này bị Git ignore. Không đưa evidence cá nhân vào commit. Chưa có đề bài final 6.3D hiện hành, nên chưa xác nhận tên file, định dạng, deadline hoặc checklist upload cuối cùng.

## Đối chiếu các yêu cầu bắt buộc của đề:

| Yêu cầu gốc | Hiện trạng | Bằng chứng và giới hạn |
| --- | --- | --- |
| Requirements và scalability concerns | Có tài liệu | Plan mục 1, 2.4 và 4.1 |
| Thiết kế scalable solution | Có thiết kế, chưa chứng minh vận hành | Tách process và event topics. Còn lỗi concurrent delivery, retry và state ở edge |
| Data collection bằng simulation hoặc hardware | Có simulation | `src/simulator.js` có shelf, POS và fridge. Hardware không bắt buộc theo đề |
| Flow based processing bằng Node-RED | Có flow và test logic | `node-red/flows.json`, 8 test. Chưa chạy lại Node-RED thật trong lần audit này |
| Event based microservices | Có local implementation | Bốn business services, MQTT và MongoDB trong Compose |
| AWS deployment và automatic scaling của microservice | Chưa có bằng chứng trong phạm vi kiểm tra | Không có AWS transport hoặc deployment definition trong tracked source. 4.2D ghi chưa bắt đầu |
| Secure deployment | Chưa đạt bằng chứng final | API mở, chưa có TLS, store authorisation, IAM hoặc X.509 trong triển khai đã kiểm chứng |
| GitHub link, deployment evidence, scaling experiments và evaluation | Chưa đủ | Có Git local. Chưa kiểm tra remote live. Chưa có bộ bằng chứng final |

## Đối chiếu cam kết trong plan:

| Hạng mục | Mức hiện tại | Phần còn thiếu |
| --- | --- | --- |
| Tuần 1: requirements, repo, compose skeleton | Có | Project board chưa xác minh. Tutor sign-off thấy trong ảnh lịch sử |
| Tuần 2: shelf, fridge, POS và edge filtering | Có local | Simulator chỉ một shelf và một fridge mỗi store. Chưa có workload 20 stores × 50 shelves |
| Tuần 3: ledger, reconciliation và velocity | Một phần | Chạy đúng happy path. Ledger và stock write chưa atomic. Restart edge có thể tăng stock sai |
| Tuần 4: replenishment và manager approval | Có local | Lỗi publish sau khi lưu approval chưa phục hồi được |
| Tuần 5: cold chain alerts | Có local | Chưa đo latency đầu cuối dưới 5 giây. Chỉ lưu breach/clear, chưa phải full temperature log |
| Tuần 5: delivery routing, ETA, tracking | Giảm scope | Một order, một stop, tọa độ mặc định. Chưa batch theo vùng, chưa tracker stream |
| Tuần 5: manager/supplier portal | Manager portal tối thiểu | Có bốn danh sách và hai thao tác. Chưa có supplier/driver workflow |
| MongoDB Atlas, SKU collection, retention | Một phần | Có Mongo adapter và URI override. SKU đang là code constant. Chưa thấy TTL 2 năm cho coldchain |
| Tuần 6: IoT Core, SNS/SQS, ECS Fargate, ALB | Chưa triển khai trong repo | MQTT adapter hiện chưa thực hiện queue transport đã cam kết |
| Tuần 6: TLS, IAM, X.509, Secrets Manager, store access | Chưa có triển khai đã kiểm chứng | Cần chứng minh cả quyền được phép và quyền bị từ chối |
| S3/CloudFront portal hosting | Chưa có bằng chứng | Đây là cam kết plan, không phải yêu cầu chỉ định dịch vụ riêng của đề gốc |
| Tuần 7: 2 tới 20 stores, Saturday rush 10× | Chưa có experiment tương ứng | Load test hiện chạy trong một process, MemoryStore và 20 tên store |
| Tuần 7: automatic scaling và CloudWatch | Chưa có bằng chứng | Chưa có before/after, CPU, memory, queue depth và task count |
| Stock latency dưới 3 giây, alert dưới 5 giây | Chưa chứng minh đầu cuối | p95 local trong RAM không đo toàn tuyến cảm biến tới trạng thái lưu hoặc notification |
| Availability 99.9% | Chưa kiểm chứng | Đây là mục tiêu plan. Một demo ngắn không chứng minh được |
| Ledger replay và sharding path | Chưa hoàn chỉnh | Có ledger, chưa có replay tool và chiến lược phục hồi được kiểm thử |
| Tuần 8: hardening và docs | Đã làm một phần | Có test và README. Các finding A1 tới A7 vẫn mở |
| Tuần 9: final report và evaluation | Chưa có bộ final được kiểm tra | 4.2D là status report, không thay final submission |

Delivery routing và portal cần được đánh giá theo scope đã được tutor chấp thuận. Trang 3 của 4.2D nói việc giảm routing còn cần sign-off. Chưa thấy bằng chứng chấp thuận đó. Không tự coi là cam kết đã được miễn. Hardware là optional enhancement theo đề cho phép simulation, không cần thêm để bù cho thiếu AWS evidence.

## Kết quả kiểm tra mới:

| Kiểm tra | Kết quả | Có thể kết luận |
| --- | --- | --- |
| V2 trước sửa, `npm run check` | 56/56 test, demo, load và config đạt | Các kiểm tra hiện có đạt ở commit gốc |
| Năm regression mới trước sửa | 5/5 thất bại đúng lỗi cần sửa | Có lỗi thật mà bộ test cũ chưa bắt |
| V2 sau sửa, `npm run check` | 61/61 test, demo, load và config đạt | Bản sửa không làm hỏng hành vi đang được test |
| Demo sau sửa | 2 stock rows, 220 units, 2 orders delivered, 4 alerts, 2 deliveries, 0 dead letters | Logic chạy đủ vòng với MemoryStore |
| Load sau sửa | 5,000/5,000 events, 42.47 ms, 117,736.98 events/s, p95 1 ms, peak backlog 100 | Kết quả một lần chạy trong RAM. Không phải AWS scaling hoặc latency đầu cuối |
| V3, `npm test` | 54/54 test đạt | Bản V3 hiện có đạt bộ test riêng |
| Diagnostic probes | A1 tới A4 đều tái hiện | Các lỗi mở bên dưới chưa được sửa |
| Docker Compose config | Hợp lệ | Cấu hình parse được, không chứng minh container chạy |
| Docker runtime | Daemon chưa chạy | Chưa kiểm tra lại MongoDB, Node-RED và toàn tuyến bằng Docker |

Node của lần kiểm tra: v24.15.0. Lần chạy test đầu bị sandbox chặn cổng với EPERM. Chạy lại với quyền local networking thì đạt. Không tính EPERM là lỗi ứng dụng. Không chạy dependency vulnerability audit mới, nên không lặp lại tuyên bố không có vulnerability từ lần kiểm tra cũ.

## Lỗi đã sửa trong branch này:

Phân loại: committed in approved project plan. Đây là sửa correctness cho validation, sensor processing và reconciliation hiện có. Không thêm feature hoặc mở rộng kiến trúc.

1. `src/edge/processor.js`: từ chối grams thiếu, không hữu hạn hoặc âm trước khi sửa shelf state. Trước đây một reading lỗi có thể làm hỏng baseline cho các reading tiếp theo.
2. Cùng file: từ chối nhiệt độ không hữu hạn trước khi sửa breach state. Trước đây NaN có thể phát CLEARED sai.
3. Cùng file: POS bắt buộc có txnId. Event ID dùng store, txnId và skuId, có escape từng thành phần. Retry cùng giao dịch vẫn được loại trùng. Hai store hoặc hai SKU khác nhau không còn đè nhau.
4. `src/services/inventory.js`: kiểm tra SKU và POS delta âm trước ledger write. Raw Node-RED validation không bảo vệ message được gửi thẳng vào business topic.
5. `src/shared/catalogue.js`: chỉ chấp nhận own property của catalogue. Tên như `toString` không còn bị coi là SKU hợp lệ.

Năm regression trong `test/regression/final-audit.test.js` kiểm tra dữ liệu và side effects thật qua MemoryStore. Test POS cũ không còn khóa vào chuỗi ID cũ.

Lưu ý khi dùng dữ liệu cũ: POS event ID đã đổi namespace. Không replay raw POS cũ vào ledger đã xử lý bằng ID cũ mà chưa có migration hoặc mapping. Không tự xóa database. Một transaction phải gộp qty theo SKU, hoặc dùng txnId riêng cho mỗi line cùng SKU. Hỗ trợ receipt line ID riêng chưa nằm trong thay đổi này.

## Các finding còn mở:

### A1: High, event được ghi nhận trước khi cập nhật stock thành công:

`src/services/inventory.js:22` ghi ledger trước `applyPhysicalDelta`, `saveStock` và publish. Nếu bước sau lỗi, retry thấy duplicate rồi dừng. Probe giả lập stock write lỗi sau khi ghi ledger: expected qty 10, actual null, retryDuplicate true. Đây là control flow thật với lỗi storage được inject, chưa phải thử crash MongoDB thật.

Unique eventId không bảo đảm một event đã được áp dụng đầy đủ. Mongo adapter cũng tách insert ledger và update stock. Cần thiết kế transaction hoặc trạng thái xử lý có thể phục hồi, kết hợp cơ chế publish đáng tin cậy. Chỉ xóa ledger khi catch lỗi không giải quyết crash giữa các bước và có thể gây double apply.

Phân loại: committed in approved project plan, cần xử lý trước thử nghiệm scaling.

### A2: High, restart edge cộng lại opening stock:

`src/edge/processor.js:15` giữ shelf baseline trong Map. Tạo lại processor rồi nhận cùng số đo 10 units tạo opening event mới. Inventory cộng thêm 10. Probe cho qty 20 dù kệ vẫn chỉ có 10. Cần baseline có thể phục hồi hoặc reconciliation theo snapshot tuyệt đối, có semantics cho mỗi shelf.

Phân loại: committed in approved project plan, cần xử lý trước tuyên bố restart reliability. Không tự thêm database edge trong audit này.

### A3: High, approval đã lưu nhưng event chưa gửi:

`src/services/replenishment.js:61` lưu APPROVED rồi publish. Nếu publish lỗi, lần gọi sau trả order hiện có mà không publish lại. Probe cho status APPROVED và 0 event thay vì 1. API ở `src/api/server.js:66` có cùng thứ tự; request sau sẽ gặp order không còn pending. Cần cơ chế lưu ý định gửi cùng với trạng thái, rồi retry an toàn.

Phân loại: committed in approved project plan, cần xử lý trước deployment evidence.

### A4: High khi chạy replicas, concurrent handling tạo hai delivery:

`src/services/delivery.js:28` thực hiện list, check, rồi insert delivery với random ID. Hai handler cùng đọc chưa có delivery sẽ tạo hai record. Probe Promise.all cho 2 deliveries thay vì 1. Mongo chỉ unique deliveryId, không unique orderId. Cần claim hoặc constraint theo orderId cùng xử lý retry. Một service đang serialise message không chứng minh nhiều replicas an toàn.

Phân loại: required by original task brief ở phần scalable microservices, đồng thời hỗ trợ commitment delivery.

### A5: Medium, secure local MQTT chưa được nối đầy đủ:

Static inspection: broker đọc MQTT_USERNAME và MQTT_PASSWORD, nhưng `src/shared/mqtt.js:5` không truyền chúng vào client. Compose cũng chưa truyền credentials cho broker, services hoặc Node-RED. Không coi broker có hàm authenticate là bằng chứng secure deployment. API và Node-RED chưa có access control; các port Compose được publish trên mọi interface mặc định.

Phân loại: required by original task brief ở phần secure deployment. Chưa chạy thử authenticated broker trong audit này.

### A6: Medium, readiness và raw input validation còn thiếu:

`/health` trả ok mà không kiểm tra Mongo hoặc MQTT. Sensor handlers chưa kiểm tra đầy đủ store, sensor ID, timestamp và thứ tự reading. Các sửa numeric validation trong branch này chỉ xử lý các lỗi đã tái hiện, không phải một schema hoàn chỉnh.

Phân loại: committed in approved project plan. Cần failure test cho dependency outage và input contract trước khi công bố deployment ổn định.

### A7: High đối với bằng chứng scaling, adapter và transport chưa đủ:

Local MQTT subscriptions phát event tới mỗi subscriber. Client IDs có process.pid, có thể trùng khi nhiều container chạy cùng service với PID 1. Mongo stock counters có atomic update, nhưng velocity được đọc rồi ghi qua bước riêng. State write và event publish chưa liên kết. Delivery completion nhận publish ACK không có nghĩa inventory đã xử lý restock. Vì vậy không thể đổi tên consumer count thành số replicas rồi coi là scaling đã đạt.

Phân loại: required by original task brief và committed in approved project plan. Cần kiểm thử nhiều process trên storage thật, queue semantics và recovery trước khi so sánh throughput.

## Đối chiếu V3 và báo cáo 4.2D:

V3 không phải bản tốt hơn chỉ vì tên version cao hơn. V2 tại commit bắt đầu đã có một số hardening mà V3 chưa có: RESTOCK_PENDING, chặn stock source lạ, POS qty bằng 0, Mongo upsert defaults, index migration chịu race, Docker USER node và DOCKER_MONGODB_URI. Không copy đè V3 vào repo V2.

4.2D báo cáo 54 test phù hợp số test V3 hiện tại. V2 hiện có 61 test sau audit. Khi viết final phải ghi rõ repo, commit và lệnh kiểm tra. Tuyên bố trong tài liệu V3 rằng một số test thất bại trên V2 cũ không còn mô tả đúng V2 đã có review-fixes.

Các câu cần chỉnh khi viết final:

1. “Local phase complete”: giới hạn thành demo chức năng local đã được kiểm tra tại một thời điểm. Không suy ra crash recovery hoặc replica safety.
2. “Physical stock is safe either way”: quá mạnh. A1 và A2 cho thấy unique index chưa đủ.
3. “Every service holds no state”: cần phân biệt domain services với edge giữ Map và broker giữ session. Trạng thái và transport ảnh hưởng trực tiếp đến AWS transition.
4. Local in-process metrics chỉ là microbenchmark. So sánh trước/sau AWS scaling phải dùng cùng tuyến đo, workload và cách tính.
5. Routing reduced cần evidence tutor chấp thuận. 4.2D ghi đang cần sign-off, chưa phải approval.

## Review local:

```bash
cd /Users/tommyanh/Desktop/Tommy_new_one/SIT314-IoT/sit314_project_v2
git switch audit/final-project-2026-09-22
git diff review-fixes...HEAD
npm run check
node scripts/audit-local-gaps.js
```

Lệnh diagnostic cuối cố ý trả exit 1 khi còn gap. Exit 2 là lỗi chạy probe. Không dùng nó làm bằng chứng pass. Nó độc lập với bộ regression 61 test. Xem `FINAL_PROJECT_CHECKLIST.md` để chọn bước tiếp theo.
