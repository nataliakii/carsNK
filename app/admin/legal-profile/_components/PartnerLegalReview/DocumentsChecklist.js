"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import {
  DOCUMENT_PROBLEM_REASON,
  DOCUMENT_PROBLEM_REASON_LABEL,
  DOCUMENT_REVIEW_STATE,
  resolveDocumentReviewState,
} from "@/domain/legal/partnerDocumentReview";
import { formatPartnerDate } from "@/app/admin/legal-profile/_components/PartnerLegalReview/reviewField";

const PROBLEM_OPTIONS = Object.values(DOCUMENT_PROBLEM_REASON);

function reviewStateLabel(state, t) {
  if (state === DOCUMENT_REVIEW_STATE.CHECKED) {
    return t("partnerLegal.review.doc.checked", { defaultValue: "Checked" });
  }
  if (state === DOCUMENT_REVIEW_STATE.PROBLEM) {
    return t("partnerLegal.review.doc.problem", { defaultValue: "Problem found" });
  }
  return t("partnerLegal.review.doc.notChecked", { defaultValue: "Not checked" });
}

function reviewStateColor(state) {
  if (state === DOCUMENT_REVIEW_STATE.CHECKED) return "success";
  if (state === DOCUMENT_REVIEW_STATE.PROBLEM) return "error";
  return "default";
}

async function readJsonBody(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export default function DocumentsChecklist({ row, onChanged, canReview }) {
  const { t } = useTranslation();
  const documents = row?.readiness?.documents || [];
  const companyId = row?.companyId || "";
  const [busyKind, setBusyKind] = useState("");
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [reviewChoice, setReviewChoice] = useState(DOCUMENT_REVIEW_STATE.CHECKED);
  const [problemReason, setProblemReason] = useState(DOCUMENT_PROBLEM_REASON.UNREADABLE);
  const [problemNote, setProblemNote] = useState("");

  async function viewDocument(kind) {
    setBusyKind(kind);
    setError("");
    const tab = window.open("about:blank", "_blank");
    try {
      const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
      const res = await fetch(`/api/partner/legal/documents${qs}`, { cache: "no-store" });
      const json = await readJsonBody(res);
      if (!res.ok || !json.success) {
        throw new Error(json.message || t("partnerLegal.documents.viewFailed"));
      }
      const match = (json.documents || []).find((doc) => doc.kind === kind);
      if (!match?.url) throw new Error(t("partnerLegal.documents.viewFailed"));
      let href = match.url;
      if (match.resourceType === "raw") {
        const fileRes = await fetch(match.url);
        if (!fileRes.ok) throw new Error(t("partnerLegal.documents.viewFailed"));
        const bytes = await fileRes.blob();
        href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      }
      if (tab) {
        tab.location.href = href;
        tab.opener = null;
      } else {
        window.location.assign(href);
      }
      if (canReview) {
        setDialog(kind);
        setReviewChoice(DOCUMENT_REVIEW_STATE.CHECKED);
        setProblemReason(DOCUMENT_PROBLEM_REASON.UNREADABLE);
        setProblemNote("");
      }
    } catch (err) {
      tab?.close();
      setError(err.message);
    } finally {
      setBusyKind("");
    }
  }

  async function saveReview() {
    if (!dialog || !companyId) return;
    setBusyKind(dialog);
    setError("");
    try {
      const body = {
        action: "review_document",
        kind: dialog,
        reviewState: reviewChoice,
      };
      if (reviewChoice === DOCUMENT_REVIEW_STATE.PROBLEM) {
        body.problemReason = problemReason;
        body.note = problemNote;
      }
      const res = await fetch(
        `/api/admin/legal/partners/${encodeURIComponent(companyId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await readJsonBody(res);
      if (!res.ok || !json.success) {
        throw new Error(json.message || t("partnerLegal.review.failed"));
      }
      setDialog(null);
      await onChanged?.(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKind("");
    }
  }

  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>
        {t("partnerLegal.review.documentsTitle", {
          defaultValue: "Supporting documents",
        })}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t("partnerLegal.review.documentsSubtitle", {
          defaultValue:
            "Open each file and mark it checked or report a problem. Opening alone does not mark it checked.",
        })}
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
        {documents.map((doc) => {
          const state = doc.uploaded
            ? resolveDocumentReviewState(doc)
            : DOCUMENT_REVIEW_STATE.NOT_CHECKED;
          const busy = busyKind === doc.kind;
          return (
            <Stack
              key={doc.kind}
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
              sx={{ py: 1.25 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 700 }}>
                    {doc.label}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={doc.required ? "warning" : "default"}
                    label={
                      doc.required
                        ? t("partnerLegal.form.required", { defaultValue: "Required" })
                        : t("partnerLegal.form.optional", { defaultValue: "Optional" })
                    }
                  />
                  {doc.uploaded ? (
                    <Chip
                      size="small"
                      color={reviewStateColor(state)}
                      label={reviewStateLabel(state, t)}
                    />
                  ) : (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t("partnerLegal.documents.notUploaded", {
                        defaultValue: "Not uploaded",
                      })}
                    />
                  )}
                </Stack>
                {doc.uploaded ? (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {[
                      doc.filename || null,
                      doc.uploadedAt
                        ? t("partnerLegal.documents.uploadedOn", {
                            date: formatPartnerDate(doc.uploadedAt),
                          })
                        : null,
                      doc.uploadedByEmail
                        ? t("partnerLegal.review.doc.uploadedBy", {
                            defaultValue: "by {{who}}",
                            who: doc.uploadedByEmail,
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                ) : null}
                {state === DOCUMENT_REVIEW_STATE.PROBLEM && doc.note ? (
                  <Typography variant="caption" color="error.main" display="block">
                    {doc.note}
                  </Typography>
                ) : null}
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {busy ? <CircularProgress size={18} /> : null}
                {doc.uploaded ? (
                  <Button size="small" onClick={() => viewDocument(doc.kind)} disabled={busy}>
                    {t("partnerLegal.review.doc.view", { defaultValue: "View document" })}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          );
        })}
      </Stack>

      <Dialog
        open={Boolean(dialog)}
        onClose={() => {
          if (!busyKind) setDialog(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t("partnerLegal.review.doc.reviewTitle", {
            defaultValue: "Document review",
          })}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("partnerLegal.review.doc.reviewBody", {
              defaultValue:
                "Opening the file does not mark it checked. Choose an outcome below.",
            })}
          </Typography>
          <RadioGroup
            value={reviewChoice}
            onChange={(event) => setReviewChoice(event.target.value)}
          >
            <FormControlLabel
              value={DOCUMENT_REVIEW_STATE.CHECKED}
              control={<Radio />}
              label={t("partnerLegal.review.doc.markChecked", {
                defaultValue: "Mark as checked",
              })}
            />
            <FormControlLabel
              value={DOCUMENT_REVIEW_STATE.PROBLEM}
              control={<Radio />}
              label={t("partnerLegal.review.doc.reportProblem", {
                defaultValue: "Report a problem",
              })}
            />
          </RadioGroup>
          {reviewChoice === DOCUMENT_REVIEW_STATE.PROBLEM ? (
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              <FormControl fullWidth size="small">
                <TextField
                  select
                  size="small"
                  label={t("partnerLegal.review.doc.problemReason", {
                    defaultValue: "Problem reason",
                  })}
                  value={problemReason}
                  onChange={(event) => setProblemReason(event.target.value)}
                >
                  {PROBLEM_OPTIONS.map((code) => (
                    <MenuItem key={code} value={code}>
                      {DOCUMENT_PROBLEM_REASON_LABEL[code]}
                    </MenuItem>
                  ))}
                </TextField>
              </FormControl>
              <TextField
                size="small"
                fullWidth
                multiline
                minRows={2}
                label={t("partnerLegal.review.doc.problemNote", {
                  defaultValue: "Details",
                })}
                value={problemNote}
                onChange={(event) => setProblemNote(event.target.value)}
                required={problemReason === DOCUMENT_PROBLEM_REASON.OTHER}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={Boolean(busyKind)}>
            {t("partnerLegal.review.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="contained"
            onClick={saveReview}
            disabled={Boolean(busyKind)}
          >
            {t("partnerLegal.review.doc.saveReview", { defaultValue: "Save" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
