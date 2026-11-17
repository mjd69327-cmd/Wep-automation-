import unittest

from security import hash_password, password_needs_rehash, verify_password
from document_processing import build_extraction_prompt, clean_filename, normalize_extraction, validate_upload


class PasswordTests(unittest.TestCase):
    def test_hash_and_verify(self):
        encoded = hash_password("a-long-passphrase")
        self.assertTrue(encoded.startswith("pbkdf2_sha256$600000$"))
        self.assertTrue(verify_password(encoded, "a-long-passphrase"))
        self.assertFalse(verify_password(encoded, "wrong-passphrase"))
        self.assertFalse(password_needs_rehash(encoded))

    def test_legacy_password_can_be_verified_for_upgrade(self):
        self.assertTrue(verify_password("legacy-pass", "legacy-pass"))
        self.assertTrue(password_needs_rehash("legacy-pass"))
        self.assertFalse(verify_password("legacy-pass", "not-the-password"))

    def test_malformed_hash_fails_closed(self):
        self.assertFalse(verify_password("pbkdf2_sha256$999999999$bad$bad", "secret"))


class DocumentProcessingTests(unittest.TestCase):
    def test_filename_cannot_escape_path(self):
        self.assertEqual(clean_filename("../../invoice.pdf"), "invoice.pdf")
        self.assertNotIn("\n", clean_filename("bad\nname.png"))

    def test_image_magic_bytes_are_checked(self):
        self.assertEqual(validate_upload("image.png", b"\x89PNG\r\n\x1a\nrest"), ("image/png", 1))
        with self.assertRaises(ValueError):
            validate_upload("image.png", b"not a png")

    def test_upload_size_is_bounded(self):
        with self.assertRaises(ValueError):
            validate_upload("image.png", b"\x89PNG\r\n\x1a\n" + b"x" * (10 * 1024 * 1024))

    def test_extraction_is_limited_to_template_keys(self):
        template = {"fields": [{"key": "total"}, {"key": "vendor"}]}
        result = normalize_extraction({"fields": {"total": {"value": 120, "confidence": 1.4, "bbox": [10, 20, 30, 40]}, "other": {"value": "ignored"}}}, template)
        self.assertEqual(result["fields"]["total"], {"value": "120", "confidence": 1.0, "bbox": [10, 20, 30, 40]})
        self.assertEqual(result["fields"]["vendor"]["value"], "")
        self.assertNotIn("other", result["fields"])

    def test_prompt_labels_document_content_untrusted(self):
        prompt = build_extraction_prompt({"fields": [{"key": "total", "label_en": "Total"}]})
        self.assertIn("untrusted data", prompt)
        self.assertIn("total", prompt)


if __name__ == "__main__":
    unittest.main()
