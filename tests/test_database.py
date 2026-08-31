import unittest
import tempfile
import os
import database


class TestDatabase(unittest.TestCase):

    def test_database_module_imports(self):
        self.assertTrue(hasattr(database, "sqlite3"))

    def test_database_file_exists(self):
        self.assertTrue(os.path.exists("offlineaid.db"))


if __name__ == "__main__":
    unittest.main()