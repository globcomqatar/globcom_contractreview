# Copyright (c) 2026, Globcom and contributors
# For license information, please see license.txt

from frappe import _

def get_sales_order_dashboard(data):
	"""Add Contract Review Records to Sales Order dashboard"""
	return extend_dashboard_with_contracts(data, "sales_order")

def get_quotation_dashboard(data):
	"""Add Contract Review Records to Quotation dashboard"""
	return extend_dashboard_with_contracts(data, "quotation")

def extend_dashboard_with_contracts(data, fieldname):
	"""Helper to add contract review records to dashboard"""
	if not data.get("transactions"):
		data["transactions"] = []

	# Check if Contracts group exists
	contract_group = None
	for group in data.get("transactions", []):
		if group.get("label") == _("Contracts"):
			contract_group = group
			break

	if not contract_group:
		contract_group = {"label": _("Contracts"), "items": []}
		data["transactions"].append(contract_group)

	# Add Contract Review Record if not already present
	if "Contract Review Record" not in contract_group.get("items", []):
		contract_group["items"].append("Contract Review Record")

	# Set fieldname mapping
	if not data.get("non_standard_fieldnames"):
		data["non_standard_fieldnames"] = {}
	data["non_standard_fieldnames"]["Contract Review Record"] = fieldname

	return data
