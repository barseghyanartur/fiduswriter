import {getMissingDocumentListData} from "../tools"
import {importFidusTemplate, documentsListItemTemplate} from "./templates"
import {SaveCopy, ExportFidusFile} from "../../exporter/native"
import {EpubExporter} from "../../exporter/epub"
import {HTMLExporter} from "../../exporter/html"
import {LatexExporter} from "../../exporter/latex"
import {DocxExporter} from "../../exporter/docx"
import {OdtExporter} from "../../exporter/odt"
import {ImportFidusFile} from "../../importer/file"
import {DocumentRevisionsDialog} from "../revisions"
import {activateWait, deactivateWait, addAlert, post} from "../../common"

export class DocumentOverviewActions {
    constructor (documentOverview) {
        documentOverview.mod.actions = this
        this.documentOverview = documentOverview
    }

    deleteDocument(id) {
        let doc = this.documentOverview.documentList.find(doc => doc.id === id)
        if (!doc) {
            return
        }
        post(
            '/document/delete/',
            {id}
        ).then(
            () => {
                addAlert('success', gettext(`${gettext('Document has been deleted')}: '${doc.title}'`))
                this.documentOverview.stopDocumentTable()
                let removedEl = document.getElementById(`Text_${id}`)
                removedEl.parentElement.removeChild(removedEl)
                this.documentOverview.documentList = this.documentOverview.documentList.filter(doc => doc.id !== id)
                this.documentOverview.startDocumentTable()
            }
        ).catch(
            () => {
                addAlert('error', gettext(`${gettext('Could not delete document')}: '${doc.title}'`))
            }
        )
    }

    deleteDocumentDialog(ids) {
        let that = this
        document.body.insertAdjacentHTML(
            'beforeend',
            `<div id="confirmdeletion" title="${gettext('Confirm deletion')}">
                <p>
                    <span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>
                    ${gettext('Delete the document(s)?')}
                </p>
            </div>`
        )
        let buttons = [
            {
                text: gettext('Delete'),
                class: "fw-button fw-dark",
                click: function () {
                    for (let i = 0; i < ids.length; i++) {
                        that.deleteDocument(ids[i])
                    }
                    jQuery(this).dialog("close")
                }
            },
            {
                text: gettext('Cancel'),
                class: "fw-button fw-orange",
                click: function () {
                    jQuery(this).dialog("close")
                }
            }
        ]

        jQuery("#confirmdeletion").dialog({
            resizable: false,
            height: 180,
            modal: true,
            close: function () {
                let confirmDeletionEl = document.getElementById("confirmdeletion")
                confirmDeletionEl.parentElement.removeChild(confirmDeletionEl)
            },
            buttons
        })
    }

    importFidus() {
        let that = this
        document.body.insertAdjacentHTML('beforend', importFidusTemplate())
        let buttons = [
            {
                text: gettext('Import'),
                class: "fw-button fw-dark",
                click: function () {
                    let fidusFile = document.getElementById('fidus-uploader').files
                    if (0 === fidusFile.length) {
                        console.warn('no file found')
                        return false
                    }
                    fidusFile = fidusFile[0]
                    if (104857600 < fidusFile.size) {
                        //TODO: This is an arbitrary size. What should be done with huge import files?
                        console.warn('file too big')
                        return false
                    }
                    activateWait()
                    let reader = new window.FileReader()
                    reader.onerror = function (e) {
                        console.warn('error', e.target.error.code)
                    }

                    let importer = new ImportFidusFile(
                        fidusFile,
                        that.documentOverview.user,
                        true,
                        that.documentOverview.teamMembers
                    )

                    importer.init().then(
                        ({doc, docInfo}) => {
                            deactivateWait()
                            addAlert('info', doc.title + gettext(
                                    ' successfully imported.'))
                            that.documentOverview.documentList.push(doc)
                            that.documentOverview.stopDocumentTable()
                            document.querySelector('#document-table tbody').insertAdjacentHTML(
                                'beforeend',
                                documentsListItemTemplate({
                                    doc,
                                    user: that.documentOverview.user
                                })
                            )
                            that.documentOverview.startDocumentTable()
                        }
                    )


                    jQuery(this).dialog('close')
                }
            },
            {
                text: gettext('Cancel'),
                class: "fw-button fw-orange",
                click: function () {
                    jQuery(this).dialog('close')
                }
            }
        ]
        jQuery("#importfidus").dialog({
            resizable: false,
            height: 180,
            modal: true,
            buttons,
            create: function () {
                document.getElementById('fidus-uploader').addEventListener(
                    'change',
                    () => {
                        document.getElementById('import-fidus-name').innerHTML =
                            document.getElementById('fidus-uploader').value.replace(/C:\\fakepath\\/i, '')
                    }
                )

                document.getElementById('import-fidus-btn').addEventListener('click', event => {
                    document.getElementById('fidus-uploader').click()
                    event.preventDefault()
                })
            },
            close: () => {
                jQuery("#importfidus").dialog('destroy').remove()
            }
        })


    }

    copyFiles(ids) {
        getMissingDocumentListData(ids, this.documentOverview.documentList).then(
            () => {
                ids.forEach(id => {
                    let doc = this.documentOverview.documentList.find(entry => entry.id === id)
                    let copier = new SaveCopy(
                        doc,
                        {db:doc.bibliography},
                        {db:doc.images},
                        this.documentOverview.user
                    )

                    copier.init().then(
                        ({doc, docInfo}) => {
                            this.documentOverview.documentList.push(doc)
                            this.documentOverview.stopDocumentTable()
                            document.querySelector('#document-table tbody').insertAdjacentHTML(
                                'beforeend',
                                documentsListItemTemplate({
                                    doc,
                                    user: this.documentOverview.user
                                }))
                            this.documentOverview.startDocumentTable()
                        }
                    )
                })
            }
        )
    }

    downloadNativeFiles(ids) {
        getMissingDocumentListData(
            ids,
            this.documentOverview.documentList
        ).then(
            () => ids.forEach(id => {
                let doc = this.documentOverview.documentList.find(entry => entry.id===id)
                new ExportFidusFile(
                    doc,
                    {db:doc.bibliography},
                    {db:doc.images}
                )
            })
        )
    }

    downloadHtmlFiles(ids) {
        getMissingDocumentListData(
            ids,
            this.documentOverview.documentList
        ).then(
            () => ids.forEach(id => {
                let doc = this.documentOverview.documentList.find(entry => entry.id===id)
                new HTMLExporter(
                    doc,
                    {db:doc.bibliography},
                    {db:doc.images},
                    this.documentOverview.citationStyles,
                    this.documentOverview.citationLocales
                )
            })
        )
    }

    downloadTemplateExportFiles(ids, templateUrl, templateType) {
        getMissingDocumentListData(
            ids,
            this.documentOverview.documentList
        ).then(
            () => {
                ids.forEach(id => {
                    let doc = this.documentOverview.documentList.find(entry => entry.id===id)
                    if (templateType==='docx') {
                        new DocxExporter(
                            doc,
                            templateUrl,
                            {db:doc.bibliography},
                            {db:doc.images},
                            this.documentOverview.citationStyles,
                            this.documentOverview.citationLocales
                        )
                    } else {
                        new OdtExporter(
                            doc,
                            templateUrl,
                            {db:doc.bibliography},
                            {db:doc.images},
                            this.documentOverview.citationStyles,
                            this.documentOverview.citationLocales
                        )
                    }
                })
            }
        )
    }

    downloadLatexFiles(ids) {
        getMissingDocumentListData(
            ids,
            this.documentOverview.documentList
        ).then(
            () =>
                ids.forEach(id => {
                    let doc = this.documentOverview.documentList.find(entry => entry.id===id)
                    new LatexExporter(
                        doc,
                        {db:doc.bibliography},
                        {db:doc.images}
                    )
                })
        )
    }

    downloadEpubFiles(ids) {
        getMissingDocumentListData(
            ids,
            this.documentOverview.documentList
        ).then(
            () =>
                ids.forEach(id => {
                    let doc = this.documentOverview.documentList.find(entry => entry.id===id)
                    new EpubExporter(
                        doc,
                        {db:doc.bibliography},
                        {db:doc.images},
                        this.documentOverview.citationStyles,
                        this.documentOverview.citationLocales
                    )
                })
        )
    }

    revisionsDialog(documentId) {
        let revDialog = new DocumentRevisionsDialog(
            documentId,
            this.documentOverview.documentList,
            this.documentOverview.user
        )
        revDialog.init().then(
          actionObject => {
            switch(actionObject.action) {
                case 'added-document':
                    this.documentOverview.documentList.push(actionObject.doc)
                    this.documentOverview.stopDocumentTable()
                    document.querySelector('#document-table tbody').insertAdjacentHTML(
                        'beforeend',
                        documentsListItemTemplate({
                            doc: actionObject.doc,
                            user: this.documentOverview.user
                        }))
                    this.documentOverview.startDocumentTable()
                    break
                case 'deleted-revision':
                    actionObject.doc.revisions = actionObject.doc.revisions.filter(rev => rev.pk !== actionObject.id)
                    if (actionObject.doc.revisions.length === 0) {
                        document.querySelectorAll(`#Text_${actionObject.doc.id} .revisions`).forEach(el => el.parentElement.removeChild(el))
                    }
                    break
            }
        })
    }
}
