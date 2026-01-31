// Copyright (c) 2026, Globcom and contributors
// For license information, please see license.txt

// Department configuration - single source of truth
const DEPARTMENT_CONFIG = {
	sales: {
		section: 'sales_and_marketing_section',
		reviewer_field: 'reviewed_by',
		designation_field: 'designation',
		signature_field: 'sign_attach',
		status_field: 'review_status',
		role: 'Sales Review'
	},
	design: {
		section: 'section_break_oowa',
		reviewer_field: 'reviewed_by_design',
		designation_field: 'designation_design',
		signature_field: 'sign_design_attach',
		status_field: 'approval_status_design',
		role: 'Manufacturing Review'
	},
	operations: {
		section: 'operations_section',
		reviewer_field: 'reviewed_by_operations',
		designation_field: 'designation_operations',
		signature_field: 'sign_operations_attach',
		status_field: 'review_status_operations',
		role: 'Operation Review'
	},
	quality: {
		section: 'quality_section',
		reviewer_field: 'reviewed_by_quality',
		designation_field: 'designation_quality',
		signature_field: 'sign_quality_attach',
		status_field: 'approval_status_quality',
		role: 'Quality Review'
	},
	purchase: {
		section: 'purchase_section',
		reviewer_field: 'reviewed_by_purchase',
		designation_field: 'designation_purchase',
		signature_field: 'sign_purchase_attach',
		status_field: 'approval_status_purchase',
		role: 'Purchase Review'
	},
	finance: {
		section: 'finance_section',
		reviewer_field: 'reviewed_by_finance',
		designation_field: 'designation__finance',
		signature_field: 'sign_finance_attach',
		status_field: 'approval_status_finance',
		role: 'Finance Review'
	},
	hse: {
		section: 'hse_health_and_safety_environment_section',
		reviewer_field: 'reviewed_by_hse',
		designation_field: 'designation_hse',
		signature_field: 'sign_hse_attach',
		status_field: 'approval_status_hse',
		role: 'HSE Review'
	}
};

frappe.ui.form.on('Contract Review Record', {
	refresh: function(frm) {
		// Set all role-based query filters on form load
		set_reviewer_filters(frm);
		// Set department permissions
		set_department_permissions(frm);
		// Auto-fill current user in editable reviewer fields
		auto_fill_current_user_reviewers(frm);
		// Render existing signatures for approved departments
		render_all_signatures(frm);

		// Add "Notify All Department" button
		if (!frm.doc.__islocal && !frm.doc.notify_all_departments) {
			frm.add_custom_button(__('Notify All Department'), function() {
				// Set notify_all_departments checkbox to checked
				frm.set_value('notify_all_departments', 1);
				// Save the document
				frm.save();
			});
		}
	},

	onload: function(frm) {
		// Set all role-based query filters when form loads
		set_reviewer_filters(frm);
		// Set department permissions
		set_department_permissions(frm);
		// Auto-fill current user in editable reviewer fields
		auto_fill_current_user_reviewers(frm);
		// Render existing signatures for approved departments
		render_all_signatures(frm);
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

// Dynamically create reviewer field handlers from config (only fetch designation)
Object.values(DEPARTMENT_CONFIG).forEach(dept => {
	frappe.ui.form.on('Contract Review Record', {
		[dept.reviewer_field]: function(frm) {
			fetch_employee_designation(frm, dept.reviewer_field, dept.designation_field);
		}
	});
});

// Dynamically create status field handlers (fetch signature when Approved or Rejected)
Object.values(DEPARTMENT_CONFIG).forEach(dept => {
	frappe.ui.form.on('Contract Review Record', {
		[dept.status_field]: function(frm) {
			// Get HTML field name (remove '_attach' from signature_field)
			let html_field = dept.signature_field.replace('_attach', '');

			// Only fetch signature when status is "Approved" or "Rejected"
			if (frm.doc[dept.status_field] === 'Approved' || frm.doc[dept.status_field] === 'Rejected') {
				fetch_employee_signature(frm, dept.reviewer_field, html_field);
			} else {
				// Clear signature if status is not Approved or Rejected
				clear_signature_html(frm, html_field);
			}
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
					'role': dept.role,
					'name': frappe.session.user  // Only show current user
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
				frm.set_value(designation_field, '');
			}
		});
}

// Helper function to fetch employee signature from User's employee record
function fetch_employee_signature(frm, user_field, signature_field) {
	let user_id = frm.doc[user_field];

	if (!user_id) {
		// Clear signature if no user
		clear_signature_html(frm, signature_field);
		return;
	}

	// Fetch Employee record where user_id matches
	frappe.db.get_value('Employee', {user_id: user_id}, 'custom_attach_sign_image')
		.then(r => {
			if (r.message && r.message.custom_attach_sign_image) {
				// Render signature with custom HTML (image on signature line)
				render_signature_html(frm, signature_field, r.message.custom_attach_sign_image);
			} else {
				// No signature found - clear field
				clear_signature_html(frm, signature_field);
			}
		});
}

// Helper function to render signature HTML with image on signature line
function render_signature_html(frm, signature_field, image_url) {
	if (!image_url) {
		clear_signature_html(frm, signature_field);
		return;
	}

	// Generate HTML with signature on a line (Frappe-style gray background)
	// Border is now handled by CSS in contract_review_signatures.css
	let signature_html = `
		<div style="background-color: #f9f9f9; border: 1px solid #d1d8dd; border-radius: 4px; padding: 20px; margin: 10px 0;">
			<div style="text-align: center;">
				<img src="${image_url}" alt="Signature" />
			</div>
		</div>
	`;

	// Render HTML to the field
	if (frm.fields_dict[signature_field] && frm.fields_dict[signature_field].$wrapper) {
		frm.fields_dict[signature_field].$wrapper.html(signature_html);
	}
}

// Helper function to clear signature HTML
function clear_signature_html(frm, signature_field) {
	if (frm.fields_dict[signature_field] && frm.fields_dict[signature_field].$wrapper) {
		frm.fields_dict[signature_field].$wrapper.html('');
	}
}

// Helper function to auto-fill current user in reviewer fields based on permissions
function auto_fill_current_user_reviewers(frm) {
	// Only auto-fill for new documents or documents without reviewers set
	Object.values(DEPARTMENT_CONFIG).forEach(dept => {
		// Check if user has the required role for this department
		// Exclude System Managers - they can manually select themselves if needed
		if (frappe.user.has_role(dept.role) && !frappe.user.has_role('System Manager')) {
			// Only set if field is empty (don't overwrite existing values)
			if (!frm.doc[dept.reviewer_field]) {
				frm.set_value(dept.reviewer_field, frappe.session.user);
				// Designation will auto-fetch via existing field handler
			}
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

// Helper function to render all existing signatures on form load
function render_all_signatures(frm) {
	// Iterate through all departments and render signatures if approved or rejected
	Object.values(DEPARTMENT_CONFIG).forEach(dept => {
		// Check if department has been reviewed and approved/rejected
		let status = frm.doc[dept.status_field];
		if ((status === 'Approved' || status === 'Rejected') && frm.doc[dept.reviewer_field]) {
			// Get HTML field name (remove '_attach' from signature_field)
			let html_field = dept.signature_field.replace('_attach', '');
			// Fetch and render signature
			fetch_employee_signature(frm, dept.reviewer_field, html_field);
		}
	});
}
