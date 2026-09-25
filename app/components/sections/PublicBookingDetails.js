"use client";

import { Box, Link, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

const Page = styled("main")(({ theme }) => ({
  maxWidth: theme.breakpoints.values.sm,
  margin: "0 auto",
  padding: theme.spacing(4, 2, 8),
  color: theme.palette.text.primary,
}));

const Card = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
}));

const Kicker = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: theme.spacing(1),
}));

const Title = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  marginBottom: theme.spacing(1),
}));

const Status = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(3),
}));

const Row = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.5),
  padding: theme.spacing(1.5, 0),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const Label = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

const Value = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
}));

const Note = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(3),
  color: theme.palette.text.secondary,
}));

function Fact({ label, value }) {
  if (value == null || String(value).trim() === "") return null;
  return (
    <Row>
      <Label variant="caption">{label}</Label>
      <Value variant="body1">{value}</Value>
    </Row>
  );
}

export function BookingLinkUnavailable() {
  return (
    <Page>
      <Card>
        <Title variant="h5">This booking link is not available</Title>
        <Status variant="body1">
          The link may be invalid or expired. Contact Rovaro support if you need help with a booking.
        </Status>
      </Card>
    </Page>
  );
}

export default function PublicBookingDetails({ view }) {
  if (!view?.readOnly) return <BookingLinkUnavailable />;

  return (
    <Page>
      <Card>
        <Kicker variant="overline">Booking reference {view.publicReference}</Kicker>
        <Title variant="h4">{view.vehicleName}</Title>
        <Status variant="body1">{view.statusLabel}</Status>
        {view.replacementNote ? <Status variant="body2">{view.replacementNote}</Status> : null}
        <Fact label="Pickup" value={view.pickupWhen} />
        <Fact label="Return" value={view.returnWhen} />
        <Fact label="Pickup location" value={view.pickupLocation} />
        <Fact label="Return location" value={view.returnLocation} />
        <Fact label="Total rental price" value={view.total} />
        <Fact label="Paid to Rovaro" value={view.bookingFee} />
        <Fact label="Pay to the rental company" value={view.supplierBalance} />
        <Fact label="Rental company" value={view.supplierName} />
        <Fact label="Phone" value={view.supplierPhone} />
        <Fact label="Email" value={view.supplierEmail} />
        <Fact label="Collection" value={view.collectionInstructions} />
        <Note variant="body2">
          The rental company can review your driving documents and contact you about collection.
        </Note>
        <Note variant="body2">
          <Link href={view.rovaroTermsHref}>{view.rovaroTermsLabel}</Link>
        </Note>
        <Note variant="body2" id="supplier-terms">
          {view.supplierTermsLabel}
          {view.supplierTermsVersion ? ` (accepted version ${view.supplierTermsVersion})` : ""}
        </Note>
        {view.supplierTermsBody ? <Note variant="body2">{view.supplierTermsBody}</Note> : null}
        <Note variant="body2">{view.cancellationNote}</Note>
        <Note variant="body2">
          <Link href={`mailto:${view.supportEmail}`}>{view.supportEmail}</Link>
        </Note>
      </Card>
    </Page>
  );
}
