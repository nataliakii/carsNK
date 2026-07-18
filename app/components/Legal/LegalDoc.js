"use client";

import React from "react";
import { Container, Typography, Box, Alert } from "@mui/material";
import { getLegalDoc } from "@utils/action";
import Preloader from "@app/components/Loader/Preloader";

/**
 * Component to render a legal document fetched from API
 * @param {Object} props
 * @param {"privacy-policy"|"terms-of-service"|"cookie-policy"} props.docType - Document type
 * @param {string} [props.lang="en"] - Language code
 * @param {"EU"|"IE"|"UA"} [props.jur="EU"] - Jurisdiction
 */
function LegalDoc({ docType, lang = "en", jur = "EU" }) {
  const [doc, setDoc] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchDoc() {
      try {
        setLoading(true);
        setError(null);
        const data = await getLegalDoc({ docType, lang, jur });
        if (!cancelled) {
          setDoc(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load document");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDoc();

    return () => {
      cancelled = true;
    };
  }, [docType, lang, jur]);

  if (loading) {
    return <Preloader loading={true} />;
  }

  if (error) {
    return (
      <Container sx={{ my: 17 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  if (!doc || !doc.content) {
    return (
      <Container sx={{ my: 17 }}>
        <Alert severity="warning">No content available</Alert>
      </Container>
    );
  }

  const { title, sections } = doc.content;

  if (!Array.isArray(sections) || sections.length === 0) {
    return (
      <Container sx={{ my: 17 }}>
        <Typography variant="h4" align="center" color="secondary.main" sx={{ my: 5 }}>
          {title || "Legal Document"}
        </Typography>
        <Alert severity="info">No content available</Alert>
      </Container>
    );
  }

  return (
    <Container sx={{ my: 7 }}>
      {doc.stale && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing cached content. Unable to fetch latest version.
        </Alert>
      )}

      <Typography
        variant="h4"
        align="center"
        color="secondary.main"
        sx={{ my: 5 }}
      >
        {title}
      </Typography>

      {sections.map((section, index) => {
        if (!section || !section.text) {
          return null;
        }

        return (
          <Box key={section.id || index} sx={{ mb: 3 }}>
            <Typography
              variant="bodyLarge"
              paragraph
              color="secondary.main"
              style={{ whiteSpace: "pre-line" }}
            >
              {section.text}
            </Typography>
          </Box>
        );
      })}
    </Container>
  );
}

export default LegalDoc;
