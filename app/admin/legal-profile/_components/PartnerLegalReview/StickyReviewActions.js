"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import { ADMIN_VIEW_MODE } from "@/domain/admin/adminViewMode";
import { PARTNER_VERIFICATION_STATUS } from "@/domain/legal/partnerVerification";
import {
  requestChangesChecklistFromReadiness,
} from "@/domain/legal/partnerReviewReadiness";
import { reviewControlsForStatus } from "@/domain/legal/partnerReviewWorkspace";
import { pendingProfileChangeSummary } from "@/domain/legal/verifiedProfileChanges";

const S = PARTNER_VERIFICATION_STATUS;

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Sticky company-level review actions. Always visible while scrolling on pending
 * applications. Approve is disabled only for missing required items or document
 * problems, with the exact reason shown beside the button.
 */
export default function StickyReviewActions({
  row,
  onChanged,
  viewMode,
  onLeftQueue,
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const platformMode = viewMode === ADMIN_VIEW_MODE.PLATFORM_ADMIN;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [checklist, setChecklist] = useState([]);
  const [moreAnchor, setMoreAnchor] = useState(null);

  const companyId = String(row?.companyId || "");
  const status = row?.verification?.status || null;
  const controls = reviewControlsForStatus(status);
  const readiness = row?.readiness;
  const canApprove = readiness?.canApprove !== false;
  const blockedReason = (readiness?.approveBlockedReasons || [])[0] || "";
  const proposed =
    row?.verification?.pendingChanges ||
    pendingProfileChangeSummary({
      verificationStatus: status,
      pendingChanges: row?.verification?.pendingChanges,
    });

  const approveChecklist = useMemo(
    () => [
      readiness?.companyDetails?.complete
        ? t("partnerLegal.review.approveCheck.detailsOk", {
            defaultValue: "Company details complete",
          })
        : t("partnerLegal.review.approveCheck.detailsMissing", {
            defaultValue: "Company details incomplete",
          }),
      readiness?.requiredDocuments?.noneRequired ||
      readiness?.requiredDocuments?.complete
        ? t("partnerLegal.review.approveCheck.docsOk", {
            defaultValue: "Required documents present",
          })
        : t("partnerLegal.review.approveCheck.docsMissing", {
            defaultValue: "Required documents missing",
          }),
      readiness?.platformAgreement === "accepted"
        ? t("partnerLegal.review.approveCheck.agreementOk", {
            defaultValue: "Platform agreement accepted",
          })
        : t("partnerLegal.review.approveCheck.agreementPending", {
            defaultValue: "Platform agreement not accepted yet",
          }),
      readiness?.listedOnMarketplace !== false
        ? t("partnerLegal.review.approveCheck.listingOn", {
            defaultValue: "Marketplace listing on",
          })
        : t("partnerLegal.review.approveCheck.listingOff", {
            defaultValue: "Marketplace listing off",
          }),
    ],
    [readiness, t]
  );

  if (!platformMode) return null;

  async function patch(body) {
    if (!companyId) return null;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/admin/legal/partners/${encodeURIComponent(companyId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await readJson(res);
      if (!res.ok || !json.success) {
        throw new Error(json.message || t("partnerLegal.review.failed"));
      }
      await onChanged?.(json);
      if (
        body.action === "approve" ||
        body.action === "request_changes" ||
        body.action === "reject" ||
        body.status === S.VERIFIED ||
        body.status === S.REJECTED
      ) {
        onLeftQueue?.();
      }
      return json;
    } catch (err) {
      setError(err.message || t("partnerLegal.review.failed"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function openChanges() {
    const seeded = requestChangesChecklistFromReadiness(readiness);
    const extras = (readiness?.documents || [])
      .filter((doc) => doc.uploaded)
      .map((doc) => ({
        type: "document",
        key: doc.kind,
        label: doc.label,
        selected: seeded.some((item) => item.key === doc.kind),
      }));
    const byKey = new Map();
    for (const item of [...seeded, ...extras]) {
      if (!byKey.has(item.key)) byKey.set(item.key, item);
    }
    // Always offer company-details + common docs as selectable items.
    const defaults = [
      { type: "field", key: "legalName", label: "Legal name", selected: false },
      {
        type: "document",
        key: "company_registration",
        label: "Company registration extract",
        selected: false,
      },
      {
        type: "document",
        key: "insurance_certificate",
        label: "Insurance certificate",
        selected: false,
      },
      {
        type: "document",
        key: "vehicle_authority",
        label: "Proof of authority to rent the vehicles",
        selected: false,
      },
    ];
    for (const item of defaults) {
      if (!byKey.has(item.key)) byKey.set(item.key, item);
    }
    setChecklist([...byKey.values()]);
    setReason("");
    setInternalNote("");
    setChangesOpen(true);
  }

  async function confirmApprove() {
    const json = await patch({ action: "approve" });
    if (json) {
      setNotice(
        t("partnerLegal.review.companyApproved", {
          defaultValue: "Company approved",
        })
      );
      setApproveOpen(false);
    }
  }

  async function confirmChanges() {
    const selected = checklist.filter((item) => item.selected);
    if (!selected.length) {
      setError(
        t("partnerLegal.review.changesItemsRequired", {
          defaultValue: "Select at least one item that needs changes",
        })
      );
      return;
    }
    if (!reason.trim()) {
      setError(t("partnerLegal.review.reasonRequired"));
      return;
    }
    const json = await patch({
      action: "request_changes",
      message: reason.trim(),
      internalNote: internalNote.trim(),
      requestedChanges: selected.map(({ type, key, label }) => ({ type, key, label })),
    });
    if (json) {
      setNotice(
        t("partnerLegal.review.changesSent", {
          defaultValue: "Change request sent",
        })
      );
      setChangesOpen(false);
    }
  }

  async function confirmReject() {
    if (!reason.trim()) {
      setError(t("partnerLegal.review.reasonRequired"));
      return;
    }
    const json = await patch({
      action: "reject",
      reason: reason.trim(),
    });
    if (json) {
      setNotice(
        t("partnerLegal.review.companyRejected", {
          defaultValue: "Company rejected",
        })
      );
      setRejectOpen(false);
    }
  }

  async function confirmSuspend() {
    if (!reason.trim()) {
      setError(t("partnerLegal.review.reasonRequired"));
      return;
    }
    const json = await patch({ action: "suspend", reason: reason.trim() });
    if (json) {
      setNotice(t("partnerLegal.review.done"));
      setSuspendOpen(false);
    }
  }

  async function confirmMove() {
    if (!reason.trim()) {
      setError(t("partnerLegal.review.reasonRequired"));
      return;
    }
    const json = await patch({
      status: S.PENDING_VERIFICATION,
      reason: reason.trim(),
    });
    if (json) {
      setNotice(t("partnerLegal.review.done"));
      setMoveOpen(false);
    }
  }

  const showPendingBar =
    controls.approve || controls.requestChanges || controls.reject;
  const showVerifiedBar = controls.suspend;
  const showDraftBar = controls.moveToReview;
  const showReopen = controls.reopenDraft;

  if (!status && !showDraftBar) return null;

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          zIndex: 8,
          mt: 2,
          mx: { xs: -1, md: 0 },
          px: { xs: 1, md: 0 },
          pb: { xs: 1, md: 0 },
        }}
      >
        <Box
          sx={{
            p: { xs: 1.5, md: 2 },
            border: "1px solid",
            borderColor: "primary.main",
            borderRadius: 2,
            bgcolor: "background.paper",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
          }}
        >
          {error ? (
            <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError("")}>
              {error}
            </Alert>
          ) : null}
          {notice ? (
            <Alert severity="success" sx={{ mb: 1 }} onClose={() => setNotice("")}>
              {notice}
            </Alert>
          ) : null}

          {Array.isArray(proposed) && proposed.length ? (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {t("partnerLegal.review.pendingChangesTitle")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={busy}
                  onClick={() => patch({ action: "apply_pending_changes" })}
                >
                  {t("partnerLegal.review.approveChanges")}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={busy}
                  onClick={() =>
                    patch({ action: "discard_pending_changes", reason: reason.trim() })
                  }
                >
                  {t("partnerLegal.review.discardChanges")}
                </Button>
              </Stack>
            </Alert>
          ) : null}

          {showPendingBar ? (
            <Stack spacing={1}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
              >
                <Button
                  variant="outlined"
                  disabled={busy || !companyId}
                  onClick={openChanges}
                >
                  {t("partnerLegal.review.requestChangesOnly", {
                    defaultValue: "Request changes",
                  })}
                </Button>
                <Button
                  variant="contained"
                  disabled={busy || !companyId || !canApprove}
                  onClick={() => setApproveOpen(true)}
                  sx={{ fontWeight: 800 }}
                >
                  {t("partnerLegal.review.approveCompany", {
                    defaultValue: "Approve company",
                  })}
                </Button>
                {isMobile ? (
                  <>
                    <IconButton
                      aria-label={t("partnerLegal.review.more", { defaultValue: "More" })}
                      onClick={(event) => setMoreAnchor(event.currentTarget)}
                      disabled={busy}
                    >
                      <MoreVertIcon />
                    </IconButton>
                    <Menu
                      anchorEl={moreAnchor}
                      open={Boolean(moreAnchor)}
                      onClose={() => setMoreAnchor(null)}
                    >
                      <MenuItem
                        onClick={() => {
                          setMoreAnchor(null);
                          setReason("");
                          setRejectOpen(true);
                        }}
                      >
                        {t("partnerLegal.review.rejectCompany", {
                          defaultValue: "Reject company",
                        })}
                      </MenuItem>
                    </Menu>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={busy || !companyId}
                    onClick={() => {
                      setReason("");
                      setRejectOpen(true);
                    }}
                  >
                    {t("partnerLegal.review.rejectCompany", {
                      defaultValue: "Reject",
                    })}
                  </Button>
                )}
              </Stack>
              {!canApprove && blockedReason ? (
                <Typography variant="caption" color="error.main">
                  {t("partnerLegal.review.approvalUnavailable", {
                    defaultValue: "Approval unavailable: {{reason}}",
                    reason: blockedReason,
                  })}
                </Typography>
              ) : null}
            </Stack>
          ) : null}

          {showVerifiedBar ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                color="warning"
                disabled={busy || !companyId}
                onClick={() => {
                  setReason("");
                  setSuspendOpen(true);
                }}
              >
                {t("partnerLegal.review.suspendCompany", {
                  defaultValue: "Suspend company",
                })}
              </Button>
            </Stack>
          ) : null}

          {showDraftBar ? (
            <Button
              variant="contained"
              disabled={busy || !companyId}
              onClick={() => {
                setReason("");
                setMoveOpen(true);
              }}
            >
              {t("partnerLegal.review.moveToReview")}
            </Button>
          ) : null}

          {showReopen ? (
            <Button
              variant="outlined"
              disabled={busy || !companyId}
              onClick={() => patch({ status: S.DRAFT, reason: "Reopened as draft" })}
            >
              {t("partnerLegal.review.reopenDraft")}
            </Button>
          ) : null}
        </Box>
      </Box>

      <Dialog open={approveOpen} onClose={() => !busy && setApproveOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {t("partnerLegal.review.approveTitle", {
            defaultValue: "Approve {{name}}?",
            name: row?.companyName || "company",
          })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("partnerLegal.review.approveBody", {
              defaultValue:
                "The company will become verified. It can operate after it has accepted the current Rovaro terms and marketplace listing is enabled.",
            })}
          </DialogContentText>
          <Stack component="ul" sx={{ m: 0, pl: 2 }}>
            {approveChecklist.map((item) => (
              <Typography component="li" key={item} variant="body2">
                {item}
              </Typography>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveOpen(false)} disabled={busy}>
            {t("partnerLegal.review.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button variant="contained" disabled={busy} onClick={confirmApprove} sx={{ fontWeight: 800 }}>
            {t("partnerLegal.review.approveCompany", {
              defaultValue: "Approve company",
            })}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={changesOpen} onClose={() => !busy && setChangesOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {t("partnerLegal.review.changesTitle", {
            defaultValue: "Request changes",
          })}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("partnerLegal.review.changesBody", {
              defaultValue:
                "Select what the company must fix. They can correct and resubmit.",
            })}
          </Typography>
          <Stack sx={{ mb: 2 }}>
            {checklist.map((item, index) => (
              <FormControlLabel
                key={`${item.type}-${item.key}`}
                control={
                  <Checkbox
                    checked={Boolean(item.selected)}
                    onChange={(event) => {
                      setChecklist((prev) =>
                        prev.map((rowItem, i) =>
                          i === index
                            ? { ...rowItem, selected: event.target.checked }
                            : rowItem
                        )
                      );
                    }}
                  />
                }
                label={item.label}
              />
            ))}
          </Stack>
          <TextField
            fullWidth
            required
            multiline
            minRows={3}
            label={t("partnerLegal.review.changesMessage", {
              defaultValue: "Message to the company",
            })}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={t("partnerLegal.review.internalNote", {
              defaultValue: "Internal note (optional)",
            })}
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangesOpen(false)} disabled={busy}>
            {t("partnerLegal.review.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button variant="contained" disabled={busy} onClick={confirmChanges}>
            {t("partnerLegal.review.sendRequest", {
              defaultValue: "Send request",
            })}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectOpen} onClose={() => !busy && setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {t("partnerLegal.review.rejectTitle", {
            defaultValue: "Reject company?",
          })}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("partnerLegal.review.rejectVsChanges", {
              defaultValue:
                "Request changes allows the company to correct and resubmit. Reject closes the current application.",
            })}
          </Alert>
          <TextField
            fullWidth
            required
            multiline
            minRows={3}
            label={t("partnerLegal.review.rejectionReason", {
              defaultValue: "Rejection reason",
            })}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)} disabled={busy}>
            {t("partnerLegal.review.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button variant="contained" color="error" disabled={busy} onClick={confirmReject}>
            {t("partnerLegal.review.rejectConfirm", {
              defaultValue: "Reject company",
            })}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={suspendOpen} onClose={() => !busy && setSuspendOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>
          {t("partnerLegal.review.suspendTitle", {
            defaultValue: "Suspend company?",
          })}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            required
            multiline
            minRows={2}
            label={t("partnerLegal.review.reason")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuspendOpen(false)} disabled={busy}>
            {t("partnerLegal.review.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button variant="contained" color="warning" disabled={busy} onClick={confirmSuspend}>
            {t("partnerLegal.review.suspendCompany", {
              defaultValue: "Suspend company",
            })}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moveOpen} onClose={() => !busy && setMoveOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("partnerLegal.review.moveToReviewTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("partnerLegal.review.moveToReviewBody")}
          </DialogContentText>
          <TextField
            fullWidth
            required
            size="small"
            label={t("partnerLegal.review.reason")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)} disabled={busy}>
            {t("partnerLegal.review.moveToReviewCancel")}
          </Button>
          <Button
            variant="contained"
            disabled={busy || !reason.trim()}
            onClick={confirmMove}
          >
            {t("partnerLegal.review.moveToReviewConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
