import React, { useId, useState } from 'react';
import {
  AlertCircle, BookOpenText, CheckCircle2, FileText, Lightbulb,
  Presentation, SearchCheck,
} from 'lucide-react';
import type {
  AiReviewPoint, AiReviewSlidePoint, AiSpeechReview,
} from '../../services/localAiReviewLibrary';

type SlideFilter = 'all' | 'attention' | 'matched';

const statusStyles = {
  matched: {
    label: 'Đã tìm thấy nội dung tương ứng',
    badge: 'bg-[#E3F3E8] text-[#246443] border-[#B4D9C0]',
    border: 'border-[#B5D9BE]',
  },
  partial: {
    label: 'Mới tìm thấy một phần',
    badge: 'bg-[#FFF2D8] text-[#855612] border-[#EAD49C]',
    border: 'border-[#EAD49C]',
  },
  not_found: {
    label: 'Chưa tìm thấy trong bản ghi ASR',
    badge: 'bg-[#FFF0E9] text-[#9A4931] border-[#F0C8B9]',
    border: 'border-[#F0C8B9]',
  },
  possible_difference: {
    label: 'Có khác biệt cần kiểm tra',
    badge: 'bg-[#FFF2D8] text-[#855612] border-[#EAD49C]',
    border: 'border-[#EAD49C]',
  },
} as const;

/** Filtering is presentation-only: it never hides or mutates the saved report. */
export function filterReviewSlides(items: AiReviewSlidePoint[], filter: SlideFilter): AiReviewSlidePoint[] {
  return items.filter(item => filter === 'all' ||
    (filter === 'attention' && !!item.status && item.status !== 'matched') ||
    (filter === 'matched' && item.status === 'matched'));
}

function EvidenceDetails({ item }: { item: AiReviewPoint }) {
  if (!item.evidenceId || !item.evidence) return null;
  return (
    <details className="mt-3 rounded-lg border border-[#E3EAE4] bg-[#FAFCFA] p-2.5 text-xs">
      <summary className="cursor-pointer font-semibold text-[#466A4F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#446B50]">
        Xem đoạn lời nói gốc · {item.evidenceId}
      </summary>
      <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-[#485C4D]">{item.evidence}</p>
    </details>
  );
}

function ReviewPointCard({
  item, index, kind,
}: {
  item: AiReviewPoint;
  index: number;
  kind: 'strength' | 'improvement';
}) {
  const improvement = kind === 'improvement';
  return (
    <article className="rounded-xl border border-[#DCE8DE] bg-white p-3 sm:p-4 space-y-2">
      <p className="text-sm font-semibold leading-relaxed text-[#304C38]">
        <span className="mr-1.5 text-[#688271]">{index + 1}.</span>{item.point}
      </p>
      {improvement && item.action && (
        <div className="rounded-lg bg-[#F2F6EE] p-3 text-sm leading-relaxed text-[#365641]">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <Lightbulb className="h-4 w-4 shrink-0" aria-hidden="true" />
            Cách cải thiện
          </div>
          <p className="break-words">{item.action}</p>
        </div>
      )}
      <EvidenceDetails item={item} />
    </article>
  );
}

function SlideComparisonCard({ item }: { item: AiReviewSlidePoint }) {
  const style = item.status ? statusStyles[item.status] : undefined;

  return (
    <article
      className={'rounded-xl border bg-white p-3 sm:p-4 space-y-3 ' + (style?.border || 'border-[#DCE8DE]')}
      aria-label={'Nhận xét slide ' + item.slideNumber}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[#EAF2EB] px-2.5 py-1 text-xs font-bold text-[#31583B]">
          Slide {item.slideNumber}
        </span>
        {style && (
          <span className={'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ' + style.badge}>
            {style.label}
          </span>
        )}
        {!style && <span className="text-xs text-[#687B6D]">Nhận xét từ bản lưu trước đây</span>}
      </div>

      <p className="text-sm font-medium leading-relaxed text-[#2F4937] break-words">{item.point}</p>

      {item.status ? (
        <>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="rounded-lg border border-[#DFE8E1] bg-[#F7FAF7] p-3 min-w-0">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#47654F]">
                <Presentation className="h-4 w-4" aria-hidden="true" />
                Chữ trích từ PowerPoint
              </p>
              <blockquote className="break-words whitespace-pre-wrap text-sm leading-relaxed text-[#2F4937]">
                “{item.slideQuote}”
              </blockquote>
            </div>
            <div className="rounded-lg border border-[#DFE8E1] bg-[#F7FAF7] p-3 min-w-0">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#47654F]">
                <BookOpenText className="h-4 w-4" aria-hidden="true" />
                {item.evidenceId ? 'Lời nói tương ứng · ' + item.evidenceId : 'Dữ liệu lời nói'}
              </p>
              {item.spokenQuote ? (
                <blockquote className="break-words whitespace-pre-wrap text-sm leading-relaxed text-[#2F4937]">
                  “{item.spokenQuote}”
                </blockquote>
              ) : (
                <p className="text-sm leading-relaxed text-[#687B6D]">
                  Chưa tìm thấy dẫn chứng lời nói tương ứng đủ căn cứ trong bản ghi ASR.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-[#DAE8DD] p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-[#366547]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {item.status === 'not_found' ? 'Kết quả dò trong ASR' : 'Nội dung đã tìm thấy'}
              </p>
              <p className="text-sm leading-relaxed break-words">{item.covered}</p>
            </div>
            <div className="min-w-0 rounded-lg border border-[#EDD9BC] p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-[#8B5D25]">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                Chưa tìm thấy / cần kiểm tra
              </p>
              <p className="text-sm leading-relaxed break-words">{item.missing}</p>
            </div>
          </div>

          <div className="rounded-lg bg-[#EDF5EF] p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-[#365C40]">
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              Gợi ý cải thiện
            </p>
            <p className="text-sm leading-relaxed break-words">{item.action}</p>
          </div>
          <EvidenceDetails item={item} />
        </>
      ) : (
        <EvidenceDetails item={item} />
      )}
    </article>
  );
}

/** Phase 7.3.3.3: display-only component. No API calls and no changes to saved reports. */
export const AiReviewResults: React.FC<{ review: AiSpeechReview }> = ({ review }) => {
  const sectionId = useId();
  const [slideFilter, setSlideFilter] = useState<SlideFilter>('all');
  const detailed = review.slideComparisons;
  const attentionCount = detailed.filter(item => item.status &&
    item.status !== 'matched').length;
  const matchedCount = detailed.filter(item => item.status === 'matched').length;
  const filtered = filterReviewSlides(detailed, slideFilter);
  const stats = review.slideReviewStats;

  return (
    <div className="space-y-5 border-t border-[#B4CDBA] pt-4" aria-label="Kết quả nhận xét AI">
      <section className="rounded-xl bg-white border border-[#D9E5DC] p-3 sm:p-4 space-y-2" aria-labelledby={sectionId + '-summary'}>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#446B50]" aria-hidden="true" />
          <h5 id={sectionId + '-summary'} className="font-bold text-sm">Nhận xét tổng quan</h5>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{review.summary}</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section aria-labelledby={sectionId + '-strengths'} className="space-y-2 min-w-0">
          <h5 id={sectionId + '-strengths'} className="flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="h-4 w-4 text-[#3A7850]" aria-hidden="true" />
            Điểm mạnh
          </h5>
          {review.strengths.map((item, index) => (
            <ReviewPointCard key={index} item={item} index={index} kind="strength" />
          ))}
        </section>

        <section aria-labelledby={sectionId + '-improvements'} className="space-y-2 min-w-0">
          <h5 id={sectionId + '-improvements'} className="flex items-center gap-2 text-sm font-bold">
            <Lightbulb className="h-4 w-4 text-[#8B6A29]" aria-hidden="true" />
            Điểm cần cải thiện
          </h5>
          {review.improvements.map((item, index) => (
            <ReviewPointCard key={index} item={item} index={index} kind="improvement" />
          ))}
        </section>
      </div>

      {(detailed.length > 0 || !!review.slideOverview?.length) && (
        <section aria-labelledby={sectionId + '-slides'} className="space-y-3">
          <div className="space-y-1">
            <h5 id={sectionId + '-slides'} className="flex items-center gap-2 text-sm font-bold">
              <Presentation className="h-4 w-4 text-[#446B50]" aria-hidden="true" />
              Đối chiếu bài nói và PowerPoint
            </h5>
            <p className="text-xs leading-relaxed text-[#65786A]">
              Chỉ đối chiếu chữ trích xuất từ PPTX với bản ghi ASR, không xác định thời điểm chuyển slide.
              Những slide chỉ được dò từ khóa không phải là kết luận đánh giá của AI.
            </p>
          </div>

          {stats && (
            <div className="rounded-xl border border-[#D9E5DC] bg-white p-3 space-y-1 text-sm">
              <p>
                <strong>Đã đối chiếu chi tiết: {stats.accepted}/{review.slideOverview?.length || stats.target} slide có chữ</strong>
              </p>
              {stats.accepted < (review.slideOverview?.length || stats.target) && (
                <p className="text-xs leading-relaxed text-[#65786A]">
                  Còn {(review.slideOverview?.length || stats.target) - stats.accepted} slide chưa có nhận xét chi tiết đủ căn cứ.
                  Xem danh sách bên dưới để biết chính xác các slide đó; không coi phần dò từ khóa là phân tích chi tiết.
                </p>
              )}
              {stats.accepted === 0 && (
                <p className="text-xs text-[#873631]">
                  Không có mục đối chiếu chi tiết nào được xác minh. Bảng dò từ khóa bên dưới chỉ dùng tham khảo.
                </p>
              )}
            </div>
          )}

          {detailed.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc nhận xét theo tình trạng slide">
                {([
                  { value: 'all', label: 'Tất cả', count: detailed.length },
                  { value: 'attention', label: 'Cần xem lại', count: attentionCount },
                  { value: 'matched', label: 'Đã tìm thấy', count: matchedCount },
                ] as const).map(filter => (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={slideFilter === filter.value}
                    onClick={() => setSlideFilter(filter.value)}
                    className={'rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#446B50] ' +
                      (slideFilter === filter.value
                        ? 'bg-[#446B50] text-white border-[#446B50]'
                        : 'bg-white text-[#446B50] border-[#BFD4C2] hover:bg-[#ECF4EE]')}
                  >
                    {filter.label} ({filter.count})
                  </button>
                ))}
              </div>

              <p className="text-xs text-[#687B6D]" role="status">
                Đang hiển thị {filtered.length}/{detailed.length} slide được đối chiếu chi tiết.
              </p>

              {filtered.length ? (
                <div className="space-y-3">
                  {filtered.map((item, index) => (
                    <SlideComparisonCard key={item.slideNumber + '-' + index} item={item} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-[#DCE8DE] bg-white p-3 text-sm text-[#687B6D]">
                  Không có slide thuộc nhóm này. Chọn “Tất cả” để xem toàn bộ mục đã đối chiếu.
                </p>
              )}
            </>
          )}

          {!!review.slideOverview?.length && (
            <details className="rounded-xl border border-[#D9E5DC] bg-white p-3 text-xs">
              <summary className="cursor-pointer font-semibold leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#446B50]">
                <span className="inline-flex items-center gap-2">
                  <SearchCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Xem bảng dò từ khóa của {review.slideOverview.length} slide có chữ (chưa phải kết luận nội dung)
                </span>
              </summary>
              <p className="my-3 leading-relaxed text-[#687B6D]">
                Chỉ so từ khóa trên slide với bản ghi. Không trùng từ khóa không có nghĩa là người học bỏ qua slide,
                vì có thể diễn đạt khác hoặc ASR nhận sai. Các slide chưa được đối chiếu chi tiết được ghi rõ.
              </p>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {review.slideOverview.map(item => {
                  const checked = detailed.some(detail => detail.slideNumber === item.slideNumber);
                  return (
                    <div key={item.slideNumber} className="rounded-lg border border-[#E3EAE4] p-2.5">
                      <p className="font-semibold break-words">
                        Slide {item.slideNumber}
                        <span className={'ml-2 font-normal ' + (checked ? 'text-[#37684A]' : 'text-[#687B6D]')}>
                          · {checked ? 'Có đối chiếu chi tiết' : 'Chưa đối chiếu chi tiết'}
                        </span>
                      </p>
                      <p className="mt-1 leading-relaxed break-words">{item.slideExcerpt}</p>
                      <p className="mt-1 text-[#687B6D]">
                        {item.keywordSignal === 'shared_keywords'
                          ? 'Từ khóa trùng: ' + item.sharedKeywords.join(', ')
                          : item.keywordSignal === 'no_shared_keywords'
                            ? 'Chưa thấy từ khóa trùng; cần kiểm tra ngữ nghĩa.'
                            : 'Quá ít chữ để dò từ khóa.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </section>
      )}

      <section className="rounded-xl border border-[#D9E5DC] bg-white p-3 sm:p-4 space-y-2" aria-labelledby={sectionId + '-limitations'}>
        <h5 id={sectionId + '-limitations'} className="flex items-center gap-2 text-sm font-bold">
          <AlertCircle className="h-4 w-4 text-[#8B6A29]" aria-hidden="true" />
          Giới hạn của nhận xét
        </h5>
        {review.limitations.length > 0 ? (
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-[#54685A]">
            {review.limitations.map((line, index) => <li key={index}>{line}</li>)}
          </ul>
        ) : (
          <p className="text-xs leading-relaxed text-[#54685A]">
            Bản ghi ASR có thể nhận diện sai; không có dữ liệu âm thanh/hình ảnh để đánh giá cách thể hiện.
          </p>
        )}
      </section>

      <p className="text-xs leading-relaxed text-[#687B6D]">
        Kết quả được lưu trên thiết bị. Mở lại Lịch sử không gọi Gemini hoặc tiêu tốn lượt phân tích.
        Bản nhận xét không đồng bộ đám mây và không chứng minh người học đã trình chiếu slide nào.
      </p>
    </div>
  );
};
