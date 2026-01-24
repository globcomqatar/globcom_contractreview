// Copyright (c) 2026, Globcom and contributors
// For license information, please see license.txt

frappe.ui.form.on('Sales Order', {
	refresh: function(frm) {
		// Add "Review Contract" button only when document is in draft status and saved
		if (frm.doc.docstatus === 0 && !frm.doc.__islocal) {
			// Check if Contract Review Record already exists for this Sales Order
			frappe.db.count('Contract Review Record', {
				filters: {'sales_order': frm.doc.name}
			}).then(count => {
				if (count === 0) {
					// Only add button if no Contract Review Record exists
					frm.add_custom_button(__('Create Contract Review'), function() {
							// Call server method to create Contract Review Record
							frappe.call({
								method: 'globcom_contract_review.globcom_contract_review.api.contract_review.create_contract_review_from_source',
								args: {
									source_doctype: 'Sales Order',
									source_name: frm.doc.name
								},
								freeze: true,
								freeze_message: __('Creating Contract Review Record...'),
								callback: function(r) {
									if (r.message) {
										frappe.show_alert({
											message: __('Contract Review Record {0} created successfully', [r.message]),
											indicator: 'green'
										}, 5);

										// Navigate to the new Contract Review Record
										frappe.set_route('Form', 'Contract Review Record', r.message);
									}
								},
								error: function(r) {
									frappe.msgprint({
										title: __('Error'),
										indicator: 'red',
										message: r.message || __('Failed to create Contract Review Record')
									});
								}
							});
						});
				}
			});
		}
	}
});
