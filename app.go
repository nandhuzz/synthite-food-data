package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
	"github.com/nandhuzz/synthite-food-data/data"
)

// ── Structs ──────────────────────────────────────────────────────────────────

type Country struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

type MaterialGroup struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

type Declaration struct {
	ID          int64  `json:"id"`
	Code        int    `json:"code"`
	Description string `json:"description"`
}

type Regulation struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ItemData is the main regulation-data table.
// Composite PK: itemid + country + MaterialName + regulationtype
type ItemData struct {
	ItemID           int    `json:"itemid"`
	MaterialName     int    `json:"materialName"`
	RegulationType   int    `json:"regulationtype"`
	Country          int    `json:"country"`
	RegulationLink   string `json:"regulationLink"`
	LabellingReq     string `json:"labellingReq"`
	PackagingReq     string `json:"packagingReq"`
	PhytoSanitaryReq string `json:"phytoSanitaryReq"`
	Declaration      int    `json:"declaration"`
	Solvent          string `json:"solvent"`
	Aflatoxin        string `json:"aflatoxin"`
	Ochratoxin       string `json:"ochratoxin"`
	HeavyMetal       string `json:"heavyMetal"`
	Pesticides       string `json:"pesticides"`
	PAH              string `json:"pah"`
	PCBs             string `json:"pcbs"`
	Remarks          string `json:"remarks"`
	Website          string `json:"website"`
	Mercury          string `json:"mercury"`
	Cadmium          string `json:"cadmium"`
	AflatoxinB1      string `json:"aflatoxinB1"`
	AflatoxinSum     string `json:"aflatoxinSum"`
	OchratoxinA      string `json:"ochratoxinA"`
	PAHLink          string `json:"pahLink"`
	Arsenic          string `json:"arsenic"`
}

// ── App ───────────────────────────────────────────────────────────────────────

type App struct {
	ctx context.Context
	db  *sql.DB
}

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	exePath, err := os.Executable()
	if err != nil {
		exePath = "."
	}
	dbPath := filepath.Join(filepath.Dir(exePath), "regulations.db")
	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on")
	if err != nil {
		fmt.Println("Failed to open DB:", err)
		return
	}
	a.db = db
	a.initSchema()
	a.seedOnce()
}

func (a *App) initSchema() {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS country (
			id   INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			code TEXT DEFAULT ''
		);`,
		`CREATE TABLE IF NOT EXISTS material_group (
			id   INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			code TEXT NOT NULL DEFAULT ''
		);`,
		`CREATE TABLE IF NOT EXISTS declaration (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			code        INTEGER NOT NULL DEFAULT 0,
			description TEXT NOT NULL DEFAULT ''
		);`,
		`CREATE TABLE IF NOT EXISTS regulation (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			name        TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT ''
		);`,
		`CREATE TABLE IF NOT EXISTS item_data (
			itemid            INTEGER PRIMARY KEY AUTOINCREMENT,
			materialName      INTEGER NOT NULL,
			regulationtype    INTEGER NOT NULL,
			country           INTEGER NOT NULL,
			regulationLink    TEXT DEFAULT '',
			labellingReq      TEXT DEFAULT '[]',
			packagingReq      TEXT DEFAULT '[]'
			phytoSanitaryReq  TEXT DEFAULT '[]'
			declaration       INTEGER DEFAULT 0,
			solvent           TEXT DEFAULT '[]'
			aflatoxin         TEXT DEFAULT '[]'
			ochratoxin        TEXT DEFAULT '[]'
			heavyMetal        TEXT DEFAULT '[]'
			pesticides        TEXT DEFAULT '[]',
			pah               TEXT DEFAULT '[]',
			pcbs              TEXT DEFAULT '[]',
			remarks           TEXT DEFAULT '[]',
			website           TEXT DEFAULT '',
			mercury           TEXT DEFAULT '[]'
			cadmium           TEXT DEFAULT '[]'
			aflatoxinB1       TEXT DEFAULT '[]'
			aflatoxinSum      TEXT DEFAULT '[]'
			ochratoxinA       TEXT DEFAULT '[]'
			pahLink           TEXT DEFAULT '',
			arsenic           TEXT DEFAULT '[]'
			UNIQUE(country, materialName, regulationtype)
		);`,
	}
	for _, s := range stmts {
		if _, err := a.db.Exec(s); err != nil {
			fmt.Println("Schema error:", err)
		}
	}
}

// seedOnce inserts sample data only if each table is still empty.
// Replace or extend these slices with real data later.
func (a *App) seedOnce() {
	// ── Countries ────────────────────────────────────────────────
	var n int
	a.db.QueryRow(`SELECT COUNT(*) FROM country`).Scan(&n)
	if n == 0 {

		for _, c := range data.CountryData {
			a.db.Exec(`INSERT INTO country (name, code) VALUES (?, ?)`, c.Name, c.Code)
		}
		fmt.Println("Seeded countries")
	}

	// ── Material Groups ──────────────────────────────────────────
	a.db.QueryRow(`SELECT COUNT(*) FROM material_group`).Scan(&n)
	if n == 0 {

		for _, m := range data.MaterialData {
			a.db.Exec(`INSERT INTO material_group (name, code) VALUES (?, ?)`, m.MaterialName, m.MaterialId)
		}
		fmt.Println("Seeded material groups")
	}

	// ── Declarations ─────────────────────────────────────────────
	a.db.QueryRow(`SELECT COUNT(*) FROM declaration`).Scan(&n)
	if n == 0 {

		for _, d := range data.DeclarationData {
			a.db.Exec(`INSERT INTO declaration (code, description) VALUES (?, ?)`, d.DeclarationID, d.DeclarationName)
		}
		fmt.Println("Seeded declarations")
	}

	// ── Regulations ──────────────────────────────────────────────
	a.db.QueryRow(`SELECT COUNT(*) FROM regulation`).Scan(&n)
	if n == 0 {
		for _, r := range data.RegulationData {
			a.db.Exec(`INSERT INTO regulation (name, description) VALUES (?, ?)`, r.RegulationName, r.RegulationId)
		}
		fmt.Println("Seeded regulations")
	}
}

// ── Country CRUD ──────────────────────────────────────────────────────────────

func (a *App) GetAllCountries() ([]Country, error) {
	rows, err := a.db.Query(`SELECT id, name, code FROM country ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Country
	for rows.Next() {
		var c Country
		rows.Scan(&c.ID, &c.Name, &c.Code)
		out = append(out, c)
	}
	if out == nil {
		out = []Country{}
	}
	return out, nil
}

func (a *App) AddCountry(name, code string) (Country, error) {
	res, err := a.db.Exec(`INSERT INTO country (name, code) VALUES (?, ?)`, name, code)
	if err != nil {
		return Country{}, err
	}
	id, _ := res.LastInsertId()
	return Country{ID: id, Name: name, Code: code}, nil
}

func (a *App) UpdateCountry(id int64, name, code string) error {
	_, err := a.db.Exec(`UPDATE country SET name=?, code=? WHERE id=?`, name, code, id)
	return err
}

func (a *App) DeleteCountry(id int64) error {
	_, err := a.db.Exec(`DELETE FROM country WHERE id=?`, id)
	return err
}

// ── MaterialGroup CRUD ────────────────────────────────────────────────────────

func (a *App) GetAllMaterialGroups() ([]MaterialGroup, error) {
	rows, err := a.db.Query(`SELECT id, name, code FROM material_group ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MaterialGroup
	for rows.Next() {
		var m MaterialGroup
		rows.Scan(&m.ID, &m.Name, &m.Code)
		out = append(out, m)
	}
	if out == nil {
		out = []MaterialGroup{}
	}
	return out, nil
}

func (a *App) AddMaterialGroup(name, code string) (MaterialGroup, error) {
	res, err := a.db.Exec(`INSERT INTO material_group (name, code) VALUES (?, ?)`, name, code)
	if err != nil {
		return MaterialGroup{}, err
	}
	id, _ := res.LastInsertId()
	return MaterialGroup{ID: id, Name: name, Code: code}, nil
}

func (a *App) UpdateMaterialGroup(id int64, name, code string) error {
	_, err := a.db.Exec(`UPDATE material_group SET name=?, code=? WHERE id=?`, name, code, id)
	return err
}

func (a *App) DeleteMaterialGroup(id int64) error {
	_, err := a.db.Exec(`DELETE FROM material_group WHERE id=?`, id)
	return err
}

// ── Declaration CRUD ──────────────────────────────────────────────────────────

func (a *App) GetAllDeclarations() ([]Declaration, error) {
	rows, err := a.db.Query(`SELECT id, code, description FROM declaration ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Declaration
	for rows.Next() {
		var d Declaration
		rows.Scan(&d.ID, &d.Code, &d.Description)
		out = append(out, d)
	}
	if out == nil {
		out = []Declaration{}
	}
	return out, nil
}

func (a *App) AddDeclaration(code int, description string) (Declaration, error) {
	res, err := a.db.Exec(`INSERT INTO declaration (code, description) VALUES (?, ?)`, code, description)
	if err != nil {
		return Declaration{}, err
	}
	id, _ := res.LastInsertId()
	return Declaration{ID: id, Code: code, Description: description}, nil
}

func (a *App) UpdateDeclaration(id int64, code int, description string) error {
	_, err := a.db.Exec(`UPDATE declaration SET code=?, description=? WHERE id=?`, code, description, id)
	return err
}

func (a *App) DeleteDeclaration(id int64) error {
	_, err := a.db.Exec(`DELETE FROM declaration WHERE id=?`, id)
	return err
}

// ── Regulation CRUD ───────────────────────────────────────────────────────────

func (a *App) GetAllRegulations() ([]Regulation, error) {
	rows, err := a.db.Query(`SELECT id, name, description FROM regulation ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Regulation
	for rows.Next() {
		var r Regulation
		rows.Scan(&r.ID, &r.Name, &r.Description)
		out = append(out, r)
	}
	if out == nil {
		out = []Regulation{}
	}
	return out, nil
}

func (a *App) AddRegulation(name, description string) (Regulation, error) {
	res, err := a.db.Exec(`INSERT INTO regulation (name, description) VALUES (?, ?)`, name, description)
	if err != nil {
		return Regulation{}, err
	}
	id, _ := res.LastInsertId()
	return Regulation{ID: id, Name: name, Description: description}, nil
}

func (a *App) UpdateRegulation(id int64, name, description string) error {
	_, err := a.db.Exec(`UPDATE regulation SET name=?, description=? WHERE id=?`, name, description, id)
	return err
}

func (a *App) DeleteRegulation(id int64) error {
	_, err := a.db.Exec(`DELETE FROM regulation WHERE id=?`, id)
	return err
}

// ── ItemData CRUD ─────────────────────────────────────────────────────────────

func (a *App) GetAllItemData() ([]ItemData, error) {
	rows, err := a.db.Query(`SELECT
		itemid, materialName, regulationtype, country,
		regulationLink, labellingReq, packagingReq, phytoSanitaryReq,
		declaration, solvent, aflatoxin, ochratoxin, heavyMetal,
		pesticides, pah, pcbs, remarks, website, mercury, cadmium,
		aflatoxinB1, aflatoxinSum, ochratoxinA, pahLink, arsenic
		FROM item_data ORDER BY itemid`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ItemData
	for rows.Next() {
		var d ItemData
		rows.Scan(
			&d.ItemID, &d.MaterialName, &d.RegulationType, &d.Country,
			&d.RegulationLink, &d.LabellingReq, &d.PackagingReq, &d.PhytoSanitaryReq,
			&d.Declaration, &d.Solvent, &d.Aflatoxin, &d.Ochratoxin, &d.HeavyMetal,
			&d.Pesticides, &d.PAH, &d.PCBs, &d.Remarks, &d.Website, &d.Mercury, &d.Cadmium,
			&d.AflatoxinB1, &d.AflatoxinSum, &d.OchratoxinA, &d.PAHLink, &d.Arsenic,
		)
		out = append(out, d)
	}
	if out == nil {
		out = []ItemData{}
	}
	return out, nil
}

func (a *App) AddItemData(d ItemData) error {
	_, err := a.db.Exec(`INSERT INTO item_data (materialName, regulationtype, country, regulationLink,
	labellingReq, packagingReq, phytoSanitaryReq, declaration, solvent, aflatoxin, ochratoxin, heavyMetal,
	pesticides, pah, pcbs, remarks, website, mercury, cadmium, aflatoxinB1, aflatoxinSum, ochratoxinA, pahLink
	, arsenic) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		d.MaterialName, d.RegulationType, d.Country,
		d.RegulationLink, d.LabellingReq, d.PackagingReq, d.PhytoSanitaryReq,
		d.Declaration, d.Solvent, d.Aflatoxin, d.Ochratoxin, d.HeavyMetal,
		d.Pesticides, d.PAH, d.PCBs, d.Remarks, d.Website, d.Mercury, d.Cadmium,
		d.AflatoxinB1, d.AflatoxinSum, d.OchratoxinA, d.PAHLink, d.Arsenic,
	)
	return err
}

func (a *App) UpdateItemData(d ItemData) error {
	_, err := a.db.Exec(`UPDATE item_data SET
		regulationLink=?, labellingReq=?, packagingReq=?, phytoSanitaryReq=?,
		declaration=?, solvent=?, aflatoxin=?, ochratoxin=?, heavyMetal=?,
		pesticides=?, pah=?, pcbs=?, remarks=?, website=?, mercury=?, cadmium=?,
		aflatoxinB1=?, aflatoxinSum=?, ochratoxinA=?, pahLink=?, arsenic=?
		WHERE itemid=? AND country=? AND materialName=? AND regulationtype=?`,
		d.RegulationLink, d.LabellingReq, d.PackagingReq, d.PhytoSanitaryReq,
		d.Declaration, d.Solvent, d.Aflatoxin, d.Ochratoxin, d.HeavyMetal,
		d.Pesticides, d.PAH, d.PCBs, d.Remarks, d.Website, d.Mercury, d.Cadmium,
		d.AflatoxinB1, d.AflatoxinSum, d.OchratoxinA, d.PAHLink, d.Arsenic,
		d.ItemID, d.Country, d.MaterialName, d.RegulationType,
	)
	return err
}

func (a *App) DeleteItemData(itemID, country, materialName, regulationType int) error {
	_, err := a.db.Exec(
		`DELETE FROM item_data WHERE itemid=? AND country=? AND materialName=? AND regulationtype=?`,
		itemID, country, materialName, regulationType,
	)
	return err
}

func (a *App) SearchItemData(query string) ([]ItemData, error) {
	like := "%" + query + "%"
	rows, err := a.db.Query(`SELECT
		itemid, materialName, regulationtype, country,
		regulationLink, labellingReq, packagingReq, phytoSanitaryReq,
		declaration, solvent, aflatoxin, ochratoxin, heavyMetal,
		pesticides, pah, pcbs, remarks, website, mercury, cadmium,
		aflatoxinB1, aflatoxinSum, ochratoxinA, pahLink, arsenic
		FROM item_data
		WHERE CAST(itemid AS TEXT) LIKE ? OR remarks LIKE ? OR website LIKE ?
		ORDER BY itemid`,
		like, like, like,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ItemData
	for rows.Next() {
		var d ItemData
		rows.Scan(
			&d.ItemID, &d.MaterialName, &d.RegulationType, &d.Country,
			&d.RegulationLink, &d.LabellingReq, &d.PackagingReq, &d.PhytoSanitaryReq,
			&d.Declaration, &d.Solvent, &d.Aflatoxin, &d.Ochratoxin, &d.HeavyMetal,
			&d.Pesticides, &d.PAH, &d.PCBs, &d.Remarks, &d.Website, &d.Mercury, &d.Cadmium,
			&d.AflatoxinB1, &d.AflatoxinSum, &d.OchratoxinA, &d.PAHLink, &d.Arsenic,
		)
		out = append(out, d)
	}
	if out == nil {
		out = []ItemData{}
	}
	return out, nil
}
