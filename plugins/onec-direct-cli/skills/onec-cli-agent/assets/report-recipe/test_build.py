import unittest

from build import sheet_name


class SheetNameTest(unittest.TestCase):
    def test_sanitizes_and_deduplicates(self):
        used = set()
        self.assertEqual(sheet_name("a/b", used), "a_b")
        self.assertEqual(sheet_name("a/b", used), "a_b_2")


if __name__ == "__main__":
    unittest.main()
