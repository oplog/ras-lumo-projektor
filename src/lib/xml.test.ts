// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseLayoutFromXml, serializeLayoutToXml } from './xml';

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<ProjectorLayoutConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" StationName="ras-test" RowCount="2" LastModified="2026-01-01T00:00:00.000+03:00" Version="1.0">
  <ScreenConfiguration DeviceName="\\\\.\\DISPLAY2" Index="1" Width="1920" Height="1080" IsPrimary="false"/>
  <MetadataConfiguration SurfaceType="PackToLight" Surface="PackToLight">
    <Face>
      <Value>A</Value>
      <Value>C</Value>
    </Face>
  </MetadataConfiguration>
  <ColumnsPerRow>
    <ColumnCount>2</ColumnCount>
    <ColumnCount>1</ColumnCount>
  </ColumnsPerRow>
  <BoundaryCorners>
    <Corner X="10" Y="20"/>
    <Corner X="100" Y="20"/>
    <Corner X="10" Y="200"/>
    <Corner X="100" Y="200"/>
  </BoundaryCorners>
  <Cells>
    <Cell Name="Sol Göz" RowIndex="1" ColumnIndex="0">
      <TopLeft X="10" Y="20"/>
      <TopRight X="55" Y="20"/>
      <BottomLeft X="10" Y="110"/>
      <BottomRight X="55" Y="110"/>
    </Cell>
    <Cell Name="Sağ-Göz &amp; 2" RowIndex="1" ColumnIndex="1">
      <TopLeft X="55" Y="20"/>
      <TopRight X="100" Y="20"/>
      <BottomLeft X="55" Y="110"/>
      <BottomRight X="100" Y="110"/>
    </Cell>
    <Cell Name="B" RowIndex="0" ColumnIndex="0">
      <TopLeft X="10" Y="110"/>
      <TopRight X="100" Y="110"/>
      <BottomLeft X="10" Y="200"/>
      <BottomRight X="100" Y="200"/>
    </Cell>
  </Cells>
</ProjectorLayoutConfiguration>`;

describe('xml round-trip', () => {
  it('parses station metadata, boundary, and cells', () => {
    const layout = parseLayoutFromXml(SAMPLE);
    expect(layout.stationName).toBe('ras-test');
    expect(layout.rowCount).toBe(2);
    expect(layout.columnsPerRow).toEqual([2, 1]);
    expect(layout.metadata.surfaceType).toBe('PackToLight');
    expect(layout.metadata.face).toEqual(['A', 'C']);
    expect(layout.boundaryCorners).toHaveLength(4);
    expect(layout.cells).toHaveLength(3);
  });

  it('preserves cell names (including special chars) across serialize → parse', () => {
    const layout = parseLayoutFromXml(SAMPLE);
    const names = layout.cells.map((c) => c.name);
    expect(names).toEqual(['Sol Göz', 'Sağ-Göz & 2', 'B']);

    // The data-loss guarantee: names survive a save round-trip unchanged.
    const reparsed = parseLayoutFromXml(serializeLayoutToXml(layout));
    expect(reparsed.cells.map((c) => c.name)).toEqual(names);
  });

  it('keeps cell coordinates and row/col indices stable across a round-trip', () => {
    const layout = parseLayoutFromXml(SAMPLE);
    const xml = serializeLayoutToXml(layout);
    const reparsed = parseLayoutFromXml(xml);
    expect(reparsed.cells).toEqual(layout.cells);
    expect(reparsed.boundaryCorners).toEqual(layout.boundaryCorners);
    expect(reparsed.rowCount).toBe(layout.rowCount);
    expect(reparsed.columnsPerRow).toEqual(layout.columnsPerRow);
  });

  it('escapes the device-name backslashes round-trip', () => {
    const layout = parseLayoutFromXml(SAMPLE);
    expect(layout.screen.deviceName).toBe('\\\\.\\DISPLAY2');
    const reparsed = parseLayoutFromXml(serializeLayoutToXml(layout));
    expect(reparsed.screen.deviceName).toBe('\\\\.\\DISPLAY2');
  });
});
