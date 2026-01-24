// Copyright (c) 2026, Globcom and contributors
// For license information, please see license.txt

// Department configuration - single source of truth
const DEPARTMENT_CONFIG = {
	sales: {
		section: 'sales_and_marketing_section',
		reviewer_field: 'reviewed_by',
		designation_field: 'designation',
		role: 'Sales Review'
	},
	design: {
		section: 'section_break_oowa',
		reviewer_field: 'reviewed_by_design',
		designation_field: 'designation_design',
		role: 'Manufacturing Review'
	},
	operations: {
		section: 'operations_section',
		reviewer_field: 'reviewed_by_operations',
		designation_field: 'designation_operations',
		role: 'Operation Review'
	},
	quality: {
		section: 'quality_section',
		reviewer_field: 'reviewed_by_quality',
		designation_field: 'designation_quality',
		role: 'Quality Review'
	},
	purchase: {
		section: 'purchase_section',
		reviewer_field: 'reviewed_by_purchase',
		designation_field: 'designation_purchase',
		role: 'Purchase Review'
	},
	finance: {
		section: 'finance_section',
		reviewer_field: 'reviewed_by_finance',
		designation_field: 'designation__finance',
		role: 'Finance Review'
	},
	hse: {
		section: 'hse_health_and_safety_environment_section',
		reviewer_field: 'reviewed_by_hse',
		designation_field: 'designation_hse',
		role: 'HSE Review'
	}
};

frappe.ui.form.on('Contract Review Record', {
	refresh: function(frm) {
		// Set all role-based query filters on form load
		set_reviewer_filters(frm);
		// Set department permissions
		set_department_permissions(frm);
	},

	onload: function(frm) {
		// Set all role-based query filters when form loads
		set_reviewer_filters(frm);
		// Set department permissions
		set_department_permissions(frm);
	},

	customer: function(frm) {
		// Clear address if customer changes
		if (frm.doc.customer) {
			// Filter address based on selected customer
			set_address_filter(frm);
		} else {
			frm.set_value('addresss', '');
		}
	}
});

// Dynamically create reviewer field handlers from config
Object.values(DEPARTMENT_CONFIG).forEach(dept => {
	frappe.ui.form.on('Contract Review Record', {
		[dept.reviewer_field]: function(frm) {
			fetch_employee_designation(frm, dept.reviewer_field, dept.designation_field);
		}
	});
});

// Helper function to set address filter
function set_address_filter(frm) {
	frm.set_query('addresss', function() {
		if (!frm.doc.customer) {
			return {
				filters: {
					'name': ''
				}
			};
		}

		return {
			filters: {
				'link_doctype': 'Customer',
				'link_name': frm.doc.customer
			}
		};
	});
}

// Helper function to set all reviewer field filters based on roles
function set_reviewer_filters(frm) {
	// Dynamically set query filters for all reviewer fields from config
	Object.values(DEPARTMENT_CONFIG).forEach(dept => {
		frm.set_query(dept.reviewer_field, function() {
			return {
				query: 'frappe.core.doctype.user.user.user_query',
				filters: {
					'role': dept.role
				}
			};
		});
	});

	// Set address filter if customer is already selected
	if (frm.doc.customer) {
		set_address_filter(frm);
	}
}

// Helper function to fetch employee designation from User's employee record
function fetch_employee_designation(frm, user_field, designation_field) {
	let user_id = frm.doc[user_field];

	if (!user_id) {
		// Clear designation if user is cleared
		frm.set_value(designation_field, '');
		return;
	}

	// Fetch Employee record where user_id matches
	frappe.db.get_value('Employee', {user_id: user_id}, 'designation')
		.then(r => {
			if (r.message && r.message.designation) {
				frm.set_value(designation_field, r.message.designation);
			} else {
				// No employee found or no designation set
				frm.set_value(designation_field, '');
			}
		});
}

// Helper function to set department-based permissions
function set_department_permissions(frm) {
	// Build section-to-roles mapping from config
	const section_roles = {};
	Object.values(DEPARTMENT_CONFIG).forEach(dept => {
		section_roles[dept.section] = [dept.role, 'System Manager'];
	});

	let current_section = null;
	let current_roles = null;

	// Iterate through all form fields in order
	for (let field of frm.fields) {
		// Track which section we're currently in
		if (field.df.fieldtype === 'Section Break') {
			if (section_roles[field.df.fieldname]) {
				current_section = field.df.fieldname;
				current_roles = section_roles[field.df.fieldname];
			} else {
				// Not a department section, reset
				current_section = null;
				current_roles = null;
			}
			continue;
		}

		// Skip Column Break
		if (field.df.fieldtype === 'Column Break') {
			continue;
		}

		// Skip fields that are already marked as read_only in DocType definition
		// (e.g., auto-filled fields like name and designation)
		if (field.df.read_only === 1) {
			continue;
		}

		// If we're inside a department section, apply role-based permissions
		if (current_section && current_roles) {
			let can_edit = frappe.user.has_role(current_roles);
			frm.set_df_property(field.df.fieldname, 'read_only', !can_edit);
		}
	}
}
