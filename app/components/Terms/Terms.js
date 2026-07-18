"use client";
import React, { useMemo } from "react";
import { Container, Box, Typography, Link as MuiLink } from "@mui/material";
import Link from "next/link";
import { terms } from "@app/data/terms";
import ApplyStyle from "@/app/components/ui/ApplyStyle";

import { useMainContext } from "@app/Context";
import { useTranslation } from "react-i18next";

function Terms() {
  const { lang } = useMainContext();
  const { t } = useTranslation();

  // Ensure terms and terms[lang] are valid objects
  const termsLang = terms[lang] || terms["en"];

  return (
    <Container sx={{ my: 17 }}>
      {Object.entries(termsLang).map(([sectionKey, sectionValue]) => {
        return (
          <div key={sectionKey}>{ApplyStyle(sectionKey, sectionValue)}</div>
        );
      })}
      <Box sx={{ mt: 6, pt: 4, borderTop: "1px solid", borderColor: "divider", textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {t("contact.haveQuestions", { defaultValue: "Остались вопросы?" })}
        </Typography>
        <MuiLink
          component={Link}
          href="/contacts"
          sx={{
            color: "primary.main",
            textDecoration: "none",
            fontWeight: 500,
            "&:hover": {
              textDecoration: "underline",
            },
          }}
        >
          {t("contact.title", { defaultValue: "Свяжитесь с нами" })}
        </MuiLink>
      </Box>
    </Container>
  );
}

export default Terms;
