import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

const CarTypography = styled(Typography)(({ theme }) => ({
  fontSize: "0.9rem",
  color: theme.palette.text.secondary,
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing(0.5),
  marginRight: theme.spacing(1.5),
}));

export default CarTypography;
