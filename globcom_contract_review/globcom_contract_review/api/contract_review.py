# Copyright (c) 2026, Globcom and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import today
from frappe.model.mapper import get_mapped_doc


@frappe.whitelist()
def create_contract_review_from_source(source_doctype, source_name):
	"""
	Create Contract Review Record from Quotation or Sales Order.

	Args:
		source_doctype (str): 'Quotation' or 'Sales Order'
		source_name (str): Name of the source document

	Returns:
		str: Name of the created Contract Review Record

	Raises:
		frappe.PermissionError: If user doesn't have create permission
		frappe.ValidationError: If source doctype is invalid or source doc doesn't exist
	"""
	# Permission check - Frappe will automatically check permissions
	if not frappe.has_permission('Contract Review Record', 'create'):
		frappe.throw(_('You do not have permission to create Contract Review Record'),
					frappe.PermissionError)

	# Validate source doctype
	if source_doctype not in ['Quotation', 'Sales Order']:
		frappe.throw(_('Invalid source doctype. Must be Quotation or Sales Order'),
					frappe.ValidationError)

	# Get source document with permission check
	try:
		source_doc = frappe.get_doc(source_doctype, source_name)
	except frappe.DoesNotExistError:
		frappe.throw(_('Source document {0} {1} does not exist').format(source_doctype, source_name))

	# Check if user has read permission on source document
	if not source_doc.has_permission('read'):
		frappe.throw(_('You do not have permission to read {0} {1}').format(source_doctype, source_name),
					frappe.PermissionError)

	# Create new Contract Review Record
	contract_review = frappe.new_doc('Contract Review Record')

	# Auto-fill date with today's date
	contract_review.date = today()

	# Map customer information - handle different field names in Quotation vs Sales Order
	if source_doctype == 'Quotation':
		# Quotation uses party_name instead of customer
		contract_review.customer = source_doc.party_name if hasattr(source_doc, 'party_name') else None
		contract_review.customer_name = source_doc.customer_name if hasattr(source_doc, 'customer_name') else None
	else:
		# Sales Order uses customer field
		contract_review.customer = source_doc.customer if hasattr(source_doc, 'customer') else None
		contract_review.customer_name = source_doc.customer_name if hasattr(source_doc, 'customer_name') else None

	# Map address display from Quotation or Sales Order
	if hasattr(source_doc, 'address_display') and source_doc.address_display:
		contract_review.addresss = source_doc.address_display

	# Set source reference link
	if source_doctype == 'Quotation':
		contract_review.quotation = source_name
	elif source_doctype == 'Sales Order':
		contract_review.sales_order = source_name

	# Copy items from source to Contract Review Record using standard Frappe mapper
	# This properly handles all fields including mandatory ones like conversion_factor
	if hasattr(source_doc, 'items') and source_doc.items:
		for source_item in source_doc.items:
			# Use as_dict() to get all fields from source item
			item_dict = source_item.as_dict()

			# Create new child row with all necessary fields
			contract_review.append('item_details', {
				'item_code': item_dict.get('item_code'),
				'item_name': item_dict.get('item_name'),
				'description': item_dict.get('description'),
				'qty': item_dict.get('qty', 1),
				'uom': item_dict.get('uom') or item_dict.get('stock_uom'),
				'rate': item_dict.get('rate', 0),
				'amount': item_dict.get('amount', 0),
				'conversion_factor': item_dict.get('conversion_factor', 1),
				'stock_uom': item_dict.get('stock_uom'),
			})

	# Insert the document (this will trigger validations and before_insert hooks)
	try:
		contract_review.insert(ignore_permissions=False)
		frappe.db.commit()

	except Exception as e:
		frappe.log_error(message=str(e), title=_('Contract Review Creation Failed'))
		frappe.throw(_('Failed to create Contract Review Record: {0}').format(str(e)))

	return contract_review.name


def get_users_with_role(role):
	"""
	Get list of users who have a specific role.

	Args:
		role (str): Role name

	Returns:
		list: List of user names who have the specified role
	"""
	users = frappe.get_all('Has Role',
		filters={'role': role, 'parenttype': 'User'},
		fields=['parent as user'],
		distinct=True
	)

	return [user.user for user in users]


@frappe.whitelist()
def get_users_by_role(role):
	"""
	API method to get users filtered by role (for client-side queries).

	Args:
		role (str): Role name to filter users

	Returns:
		list: List of dicts with user information
	"""
	if not role:
		return []

	# Get users with the specified role
	users = frappe.db.sql("""
		SELECT DISTINCT u.name, u.full_name, u.email
		FROM `tabUser` u
		INNER JOIN `tabHas Role` hr ON hr.parent = u.name
		WHERE hr.role = %(role)s
			AND u.enabled = 1
			AND u.name NOT IN ('Guest', 'Administrator')
		ORDER BY u.full_name
	""", {'role': role}, as_dict=True)

	return users
