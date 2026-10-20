"""Focused standard-library tests for the new artifact, not PoC runtime tests."""

import copy
import json
import re
import tempfile
import unittest
import zipfile
from pathlib import Path

from openpyxl import load_workbook
from defusedxml import ElementTree

from generate import HERE, SCENARIOS, Planner, assumptions, evaluate, load_inputs, month_date, recalculate


class ArithmeticTests(unittest.TestCase):
    def setUp(self):
        self.data = load_inputs()

    def set_a(self, key, value):
        for row in self.data["assumptions"]:
            if row[0] == key:
                row[2:5] = [value] * 3

    def test_known_case_and_cash(self):
        self.data["staff"] = [{
            "id": "TEST", "role": "Synthetic", "type": "Employee", "salary": 120000,
            "source": "ASSUMPTION", "scope": "Core",
            "ramps": {s: [2, 3, 1, 1, 1, 1] for s in SCENARIOS}
        }]
        self.data["costs"] = [
            ["X", "LEGAL", "Synthetic one-off", "Both", "Core", 3, 3, "Once",
             "Fixed", 100, "ASSUMPTION", "Quote required", ""]
        ]
        for key in ("salary_growth", "inflation", "contingency", "recruiting", "equipment", "new_customers", "financing_amount"):
            self.set_a(key, 0)
        self.set_a("burden", 0.25)
        self.set_a("initial_cash", 10000)
        result = evaluate(self.data, "Base")
        self.assertEqual([r["labor"] for r in result["monthly"][:4]], [0, 12500, 12500, 0])
        self.assertEqual(result["spend"], 25100)
        self.assertEqual(result["cash_low"], -15100)
        self.assertEqual(result["gap"], 15100)
        self.assertEqual(result["first_negative"], 2)
        self.assertEqual(result["quote_subtotal"], 100)
        self.assertEqual(sum(r["LEGAL"] for r in result["monthly"]), 100)

    def test_scenarios_and_optional_gates(self):
        baseline = {s: evaluate(self.data, s) for s in SCENARIOS}
        self.assertLess(baseline["Lean"]["spend"], baseline["Base"]["spend"])
        self.assertLess(baseline["Base"]["spend"], baseline["Growth"]["spend"])
        for scenario, result in baseline.items():
            self.assertEqual(result["optional_vendor"], 0)
            self.assertTrue(all(r["AI"] == r["CTMS"] == 0 for r in result["monthly"]))
            for option in ("ai", "ctms"):
                changed = copy.deepcopy(self.data)
                changed["controls"][option] = 1
                expanded = evaluate(changed, scenario)
                self.assertGreater(expanded["spend"], result["spend"])
                start = int(assumptions(self.data, scenario)[option + "_start"])
                self.assertEqual(expanded["monthly"][:start-1], result["monthly"][:start-1])

    def test_reconciliation_funding_and_no_duplicate_labor(self):
        for s in SCENARIOS:
            result = evaluate(self.data, s)
            self.assertAlmostEqual(result["spend"], sum(r["spend"] for r in result["annual"]))
            self.assertAlmostEqual(result["spend"], sum(r["spend"] for r in result["calendar"]))
            self.assertEqual(len(result["monthly"]), 60)
            for r in result["monthly"]:
                self.assertAlmostEqual(r["closing"], r["opening"] + r["financing"] + r["revenue"] - r["spend"])
                self.assertAlmostEqual(r["spend"], r["labor"] + r["recruiting"] + r["equipment"] + r["vendor"] + r["contingency"] + r["payment"])
                self.assertEqual(r["gap"], max(0, -r["closing"]))
        self.assertFalse(any("STAFF" in c[:2] for c in self.data["costs"]))
        without_revenue = copy.deepcopy(self.data)
        for row in without_revenue["assumptions"]:
            if row[0] == "arpa":
                row[2:5] = [0, 0, 0]
        result = evaluate(without_revenue, "Base")
        self.assertTrue(all(r["closing"] == r["no_revenue"] for r in result["monthly"]))

    def test_founder_economic_cash_and_exclusive_stack(self):
        base = evaluate(self.data, "Base")
        self.assertGreater(base["unpaid_founder"], 0)
        self.data["controls"]["founder_paid"] = 1
        paid = evaluate(self.data, "Base")
        self.assertEqual(paid["unpaid_founder"], 0)
        self.assertGreater(paid["spend"], base["spend"])
        self.data["controls"]["founder_paid"] = 0
        self.data["controls"]["stack"] = "AWS"
        aws = evaluate(self.data, "Base")
        # AWS app/DB allowance 1100 replaces Azure 400+600, not additive.
        self.assertAlmostEqual(aws["monthly"][0]["INFRA"] - base["monthly"][0]["INFRA"], 100)

    def test_month_arithmetic(self):
        self.assertEqual(str(month_date("2026-11-01", 60)), "2031-10-01")
        self.assertEqual(str(month_date("2024-02-01", 13)), "2025-02-01")

    def test_zero_cash_and_first_month_financing(self):
        self.set_a("initial_cash", 0)
        self.assertEqual(evaluate(self.data, "Base")["first_negative"], "Not funded")
        self.set_a("financing_month", 1)
        self.set_a("financing_amount", 1e9)
        self.assertEqual(evaluate(self.data, "Base")["first_negative"], ">60 months")

    def test_annual_service_placement(self):
        self.data["staff"] = []
        self.data["costs"] = [["X", "LEGAL", "Synthetic annual", "Both", "Core", 2, 25,
                                "Annual", "Fixed", 100, "ASSUMPTION", "Quote required", ""]]
        self.set_a("inflation", 0)
        result = evaluate(self.data, "Base")
        self.assertEqual([r["month"] for r in result["monthly"] if r["LEGAL"]], [2, 14])
        self.assertEqual(result["quote_subtotal"], 200)


class PackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load_inputs()
        cls.scope = json.loads((HERE / "scope.json").read_text())
        cls.sources = json.loads((HERE / "sources.json").read_text())
        cls.temp = tempfile.TemporaryDirectory()
        cls.path = Path(cls.temp.name) / "model.xlsx"
        cls.wb = Planner(cls.data, cls.scope, cls.sources).build()
        cls.wb.save(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_package_no_external_links_and_xml(self):
        with zipfile.ZipFile(self.path) as archive:
            self.assertIsNone(archive.testzip())
            self.assertFalse(any("externalLink" in n or "vbaProject" in n for n in archive.namelist()))
            for name in archive.namelist():
                if name.endswith(".xml"):
                    ElementTree.fromstring(archive.read(name))
        loaded = load_workbook(self.path)
        self.assertEqual(len(loaded.sheetnames), 19)
        self.assertEqual(loaded["Monthly Model"].max_row, 65)

    def test_formula_links_and_chart_ranges(self):
        count = 0
        for ws in self.wb:
            for row in ws:
                for cell in row:
                    if cell.data_type != "f":
                        continue
                    count += 1
                    self.assertNotIn("#REF!", cell.value)
                    self.assertNotIn("[", cell.value)
                    for sheet in re.findall(r"'([^']+)'!", cell.value):
                        self.assertIn(sheet, self.wb.sheetnames)
        self.assertGreater(count, 20000)
        charts = [chart for ws in self.wb for chart in ws._charts]
        self.assertEqual(len(charts), 7)
        for chart in charts:
            for series in chart.series:
                self.assertIn("!", series.val.numRef.f)
                self.assertNotIn("#REF!", series.val.numRef.f)
        self.assertIn("$AC$6:$AC$65", charts[1].series[0].val.numRef.f)

    def test_traceability_and_source_ids(self):
        source_ids = {s["id"] for s in self.sources}
        self.assertEqual(len(source_ids), len(self.sources))
        self.assertEqual(len({c[0] for c in self.data["costs"]}), len(self.data["costs"]))
        for c in self.data["costs"]:
            self.assertIn(c[10], source_ids)
            self.assertGreater(c[9], 0, "No unknown price silently free")
        for staff in self.data["staff"]:
            self.assertIn(staff["source"], source_ids)
        wbs_ids = {w["id"] for w in self.scope["wbs"]}
        req_ids = {r["id"] for r in self.scope["requirements"]}
        for req in self.scope["requirements"]:
            self.assertIn(req["wbs"], wbs_ids)
            self.assertIn(req["status"], ("Idea", "Implemented", "Verified", "In customer use"))
        for work in self.scope["wbs"]:
            self.assertIn(work["requirement"], req_ids)
            self.assertIsInstance(work["effort_days"], (int, float))
            self.assertGreater(work["effort_days"], 0)


def validate_cached(path, data=None):
    """Compare LibreOffice/Excel cached formulas with independent Python arithmetic."""
    workbook = load_workbook(path, data_only=True)
    formulas = load_workbook(path, data_only=False)
    errors = []
    for ws in workbook:
        for row in ws:
            for cell in row:
                if cell.data_type == "e":
                    errors.append((ws.title, cell.coordinate, cell.value))
    if errors:
        raise AssertionError(f"Cached formula errors: {errors[:20]}")
    data = copy.deepcopy(data or load_inputs())
    # Allow validation of a recalculated sensitivity workbook after editing its controls.
    data["selected"] = workbook["Start Here"]["B5"].value
    data["start"] = workbook["Start Here"]["B6"].value.date().isoformat()
    data["controls"].update(ai=workbook["Start Here"]["B7"].value,
                            ctms=workbook["Start Here"]["B8"].value,
                            stack=workbook["Start Here"]["B9"].value,
                            founder_paid=workbook["Start Here"]["B10"].value)
    for scenario in SCENARIOS:
        result = evaluate(data, scenario)
        ws = workbook["Monthly " + scenario]
        columns = {"I": "fte", "J": "heads", "K": "labor", "L": "recruiting", "M": "equipment",
                   "N": "INFRA", "Z": "vendor", "AC": "spend", "AD": "revenue", "AI": "closing",
                   "AK": "gap", "AM": "quote", "AO": "unpaid"}
        for month in result["monthly"]:
            for col, key in columns.items():
                cached = ws[f"{col}{month['month']+5}"].value
                if cached is None or abs(cached - month[key]) > 0.001:
                    raise AssertionError((scenario, month["month"], col, cached, month[key]))
    for coordinate in ("E25", "E26"):
        if abs(workbook["Annual Summary"][coordinate].value) > 0.001:
            raise AssertionError("Annual reconciliation failure")
    expected = evaluate(data, data["selected"])
    for coordinate, key in (("B13", "spend"), ("B14", "year1"), ("B15", "peak_fte"),
                            ("B16", "cash_low"), ("B17", "gap"), ("B19", "quote_subtotal")):
        if abs(workbook["Start Here"][coordinate].value - expected[key]) > 0.001:
            raise AssertionError((coordinate, expected[key]))
    if workbook["Start Here"]["B22"].value != expected["first_negative"]:
        raise AssertionError("Runway mismatch")
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None or any("externalLink" in n or "vbaProject" in n for n in archive.namelist()):
            raise AssertionError("Invalid or externally linked package")
    if sum(len(ws._charts) for ws in formulas) != 7:
        raise AssertionError("Charts lost in recalculation")
    for ws in formulas:
        for row in ws:
            for cell in row:
                if cell.data_type == "f" and workbook[ws.title][cell.coordinate].value is None:
                    raise AssertionError(("Missing formula cache", ws.title, cell.coordinate))
    print(f"Cached workbook validated: {path}")


def validate_sensitivities():
    scope = json.loads((HERE / "scope.json").read_text())
    sources = json.loads((HERE / "sources.json").read_text())
    variants = [
        ("ai-only", {"ai": 1}, "Lean", "2026-11-01"),
        ("ctms-only", {"ctms": 1}, "Growth", "2026-11-01"),
        ("both-aws-paid-founder", {"ai": 1, "ctms": 1, "stack": "AWS", "founder_paid": 1}, "Growth", "2028-02-01"),
        ("january-start", {}, "Base", "2030-01-01")
    ]
    with tempfile.TemporaryDirectory(prefix="saas-sensitivity-") as temp:
        for name, controls, scenario, start in variants:
            data = load_inputs()
            data["controls"].update(controls)
            data.update(selected=scenario, start=start)
            path = Path(temp) / f"{name}.xlsx"
            Planner(data, scope, sources).build().save(path)
            recalculate(path)
            validate_cached(path, data)


if __name__ == "__main__":
    import sys
    if len(sys.argv) == 3 and sys.argv[1] == "--cached":
        validate_cached(Path(sys.argv[2]))
    elif sys.argv[1:] == ["--sensitivities"]:
        validate_sensitivities()
    else:
        unittest.main()
